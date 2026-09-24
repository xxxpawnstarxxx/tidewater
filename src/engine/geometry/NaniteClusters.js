import { Box3 } from '../math/Box3.js';
import { Sphere } from '../math/Sphere.js';
import { Vector3 } from '../math/Vector3.js';

const _point = new Vector3();
const _center = new Vector3();

/**
 * Builds the CPU-side data used by the Nanite-style visibility path.
 * Clusters are deliberately small so the same metadata can later feed a
 * compute-driven indirect draw without changing asset formats.
 */
export function buildNaniteClusters( geometry, { trianglesPerCluster = 128 } = {} ) {

	const position = geometry.attributes.position;
	if ( ! position ) return null;
	const index = geometry.index;
	const triangleCount = index ? index.count / 3 : position.count / 3;
	const clusters = [];

	for ( let firstTriangle = 0; firstTriangle < triangleCount; firstTriangle += trianglesPerCluster ) {

		const count = Math.min( trianglesPerCluster, triangleCount - firstTriangle );
		const box = new Box3().makeEmpty();
		let vertexCount = 0;
		for ( let t = 0; t < count; t ++ ) {
			for ( let corner = 0; corner < 3; corner ++ ) {
				const element = firstTriangle * 3 + t * 3 + corner;
				const vertex = index ? index.getX( element ) : element;
				_point.fromBufferAttribute( position, vertex );
				box.expandByPoint( _point );
				vertexCount ++;
			}
		}
		box.getCenter( _center );
		const sphere = new Sphere().setFromPoints( [ box.min, box.max ] );
		clusters.push( { first: firstTriangle * 3, count: count * 3, bounds: sphere, center: _center.clone(), vertexCount } );

	}

	geometry.userData.nanite = { clusters, trianglesPerCluster, triangleCount, visible: clusters.length, culled: 0 };
	return geometry.userData.nanite;

}

export function selectNaniteClusters( geometry, camera, object, { error = 1 } = {} ) {

	const data = geometry.userData.nanite;
	if ( ! data || ! camera ) return null;
	const visible = [];
	const world = object.matrixWorld;
	for ( const cluster of data.clusters ) {
		const center = cluster.center.clone().applyMatrix4( world );
		const radius = cluster.bounds.radius * Math.max( object.scale.x, object.scale.y, object.scale.z );
		const distance = Math.max( 0.001, center.distanceTo( camera.position ) );
		const projectedError = radius / distance * camera.projectionMatrix.elements[ 5 ];
		if ( projectedError >= 0.0008 * error ) visible.push( cluster );
	}
	data.visible = visible.length;
	data.culled = data.clusters.length - visible.length;
	return visible;
}

export function naniteStats( geometry ) {
	const data = geometry.userData.nanite;
	return data ? { clusters: data.clusters.length, visible: data.visible, culled: data.culled, triangles: data.triangleCount } : null;
}

export function markNaniteGeometry( geometry, options ) {
	return geometry.userData.nanite ? geometry.userData.nanite : buildNaniteClusters( geometry, options );
}

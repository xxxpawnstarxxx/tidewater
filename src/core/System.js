export class System {

	constructor( context = {} ) {

		this.context = context;
		this.enabled = true;

	}

	start() {}
	update() {}
	stop() {}
	destroy() {}

}

export class SystemGroup extends System {

	constructor( systems = [], context = {} ) {

		super( context );
		this.systems = systems.filter( Boolean );

	}

	add( system ) {

		this.systems.push( system );
		if ( this.context.started && system.start ) system.start( this.context );
		return system;

	}

	start( context = this.context ) {

		this.context = context;
		this.context.started = true;
		for ( const system of this.systems ) if ( system.start ) system.start( context );

	}

	update( dt, context = this.context ) {

		if ( ! this.enabled ) return;
		for ( const system of this.systems ) if ( system.enabled !== false && system.update ) system.update( dt, context );

	}

	stop( context = this.context ) {

		for ( const system of this.systems ) if ( system.stop ) system.stop( context );
		this.context.started = false;

	}

	destroy( context = this.context ) {

		for ( const system of this.systems ) if ( system.destroy ) system.destroy( context );
		this.systems.length = 0;

	}

}

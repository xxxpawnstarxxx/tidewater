import { System, SystemGroup } from '../../core/System.js';
import { Minimap } from '../Minimap.js';
import { Guide } from '../Guide.js';
import { GameHUD } from '../GameHUD.js';

export class GameInputSystem extends System {

	update( _dt, game ) {

		const { app } = game;
		const inp = app.input;
		const can = game.canFish;
		if ( inp.hit( 'KeyR' ) && can && ! game.fight ) {

			game.rod.equip( ! game.rod.equipped );
			if ( ! game.rod.equipped ) game.cancelLine();
			game.toast( game.rod.equipped ? 'Rod out · hold left mouse to cast' : 'Rod away', 1600 );

		}
		if ( ! can && game.rod.equipped ) {

			game.cancelLine( true );
			game.rod.equip( false );

		}
		if ( inp.hit( 'KeyM' ) && game.minimap ) game.minimap.toggleExpanded();
		if ( inp.hit( 'KeyK' ) ) app.toggleWireframe();
		if ( game.hud && ( inp.hit( 'KeyI' ) || inp.hit( 'Tab' ) ) ) game.hud.toggleInventory();
		if ( game.hud && inp.hit( 'Escape' ) ) {

			game.hud.toggleInventory( false );
			game.hud.closeStand();

		}

	}

}

export class GamePresentationSystem extends System {

	start( game ) {

		const ui = game.app.ui && game.app.ui.ui;
		if ( ! ui || typeof document === 'undefined' || ! document.head ) return;
		if ( ! game.hud ) game.hud = new GameHUD( ui, game );
		if ( ! game.minimap ) game.minimap = new Minimap( ui.hud || ui.root, game );
		if ( ! game.guide ) game.guide = new Guide( ui, game, game.minimap );
		ui.onReplayGuide = () => game.guide.replay();

	}

	update( dt, game ) {

		if ( game.hud && game.hud.portrait ) game.hud.portrait.update( dt );
		if ( game.hud ) game.hud.update( game.getHUDState() );
		if ( game.minimap ) game.minimap.update( dt );
		if ( game.guide ) game.guide.update( dt );

	}

}

export class GameSystemGroup extends SystemGroup {

	constructor( game ) {

		super( [ new GameInputSystem(), new GamePresentationSystem() ], game );

	}

}

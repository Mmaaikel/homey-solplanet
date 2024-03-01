'use strict';

const Homey = require( 'homey' );

class SolPlanet extends Homey.App {
	
	/**
	 * onInit is called when the app is initialized.
	 */
	async onInit() {
		this.log( 'MyApp has been initialized' );
	}
	
}

module.exports = SolPlanet;

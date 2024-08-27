import { Device } from 'homey'
import { clearInterval } from 'node:timers'

export class Inverter extends Device {
	
	/** The refresh interval in seconds */
	interval;
	currentInterval;
	
	setInterval( interval ) {
		this.currentInterval = this.homey.setInterval(
			this.checkProduction.bind(this),
			interval * 1000
		);
	}
	
	resetInterval( newInterval ) {
		this.homey.clearInterval( this.currentInterval );
		this.setInterval( newInterval );
	}
	
	stopInterval() {
		this.homey.clearInterval( this.currentInterval )
	}
	
	async onInit() {
		if (!this.interval) {
			throw new Error("Expected interval to be set");
		}
		
		this.homey.log("Initializing device");
		
		this.setInterval( this.interval );
		
		// Force immediate production check
		this.checkProduction.bind(this)();
	}
	
	checkProduction() {
		throw new Error("Expected override");
	}
}

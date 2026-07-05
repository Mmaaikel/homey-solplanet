import Homey from 'homey';

export class Inverter extends Homey.Device {
	
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

	setValueWithCatch( capabilityId, value ) {
		const oldValue = this.getCapabilityValue( capabilityId );

		this.setCapabilityValue( capabilityId, value ).catch( this.onError.bind( this ) );

		return {
			isChanged: oldValue !== value,
			oldValue: oldValue,
			newValue: value
		}
	}

	_triggerFlowCard(id, tokens = {}, state = {}) {
		try {
			this.homey.flow
				.getDeviceTriggerCard(id)
				.trigger(this, tokens, state)
				.catch(err => this.error(`Failed to trigger flow card "${id}"`, err));
		} catch (err) {
			this.error(`Flow card "${id}" is not available`, err);
		}
	}
}

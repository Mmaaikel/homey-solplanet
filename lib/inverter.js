import Homey from 'homey';

export class Inverter extends Homey.Device {
	
	/** The refresh interval in seconds */
	interval;
	currentInterval;
	connectionOnline;
	_flowStates = {};
	_faultSignatures = {};
	
	setInterval( interval ) {
		if( this.currentInterval ) {
			this.homey.clearInterval( this.currentInterval );
		}

		this.currentInterval = this.homey.setInterval(
			this.checkProduction.bind(this),
			interval * 1000
		);
	}
	
	resetInterval( newInterval ) {
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

	parseApiNumber(value, { divisor = 1, invalidValues = [] } = {}) {
		if( value === undefined || value === null || value === '' ) {
			return null;
		}
		if( typeof value !== 'number' && typeof value !== 'string' ) {
			return null;
		}

		const parsed = Number(value);
		if( !Number.isFinite(parsed) || invalidValues.includes(parsed) ) {
			return null;
		}

		return parsed / divisor;
	}

	updateInverterDiagnostics(inverterData) {
		for( let index = 0; index < 3; index++ ) {
			const phase = index + 1;
			const phasePower = this.parseApiNumber(inverterData[`pac${ phase }`], {
				invalidValues: [-2147483648, -32768, 0xFFFFFFFF],
			});
			const phaseVoltage = this.parseApiNumber(inverterData.vac?.[index], {
				divisor: 10,
				invalidValues: [0xFFFF],
			});
			const phaseCurrent = this.parseApiNumber(inverterData.iac?.[index], {
				divisor: 10,
				invalidValues: [0xFFFF],
			});

			if( phasePower !== null && this.hasCapability(`measure_power.phase${ phase }`) ) {
				this.setValueWithCatch(`measure_power.phase${ phase }`, phasePower);
			}

			if( phaseVoltage !== null && this.hasCapability(`measure_voltage.phase${ phase }`) ) {
				this.setValueWithCatch(`measure_voltage.phase${ phase }`, phaseVoltage);
			}

			if( phaseCurrent !== null && this.hasCapability(`measure_current.phase${ phase }`) ) {
				this.setValueWithCatch(`measure_current.phase${ phase }`, phaseCurrent);
			}

			const pvVoltage = this.parseApiNumber(inverterData.vpv?.[index], {
				divisor: 10,
				invalidValues: [0xFFFF],
			});
			const pvCurrent = this.parseApiNumber(inverterData.ipv?.[index], {
				divisor: 100,
				invalidValues: [0xFFFF],
			});

			if( pvVoltage !== null && pvCurrent !== null && this.hasCapability(`measure_power.mppt${ phase }`) ) {
				this.setValueWithCatch(`measure_power.mppt${ phase }`, pvVoltage * pvCurrent);
			}
		}
	}

	calculatePvPower(inverterData) {
		let pvPower = 0;
		let hasMpptData = false;

		for( let index = 0; index < 3; index++ ) {
			const pvVoltage = this.parseApiNumber(inverterData.vpv?.[index], {
				divisor: 10,
				invalidValues: [0xFFFF],
			});
			const pvCurrent = this.parseApiNumber(inverterData.ipv?.[index], {
				divisor: 100,
				invalidValues: [0xFFFF],
			});

			if( pvVoltage === null || pvCurrent === null ) {
				continue;
			}

			pvPower += pvVoltage * pvCurrent;
			hasMpptData = true;
		}

		return hasMpptData ? pvPower : null;
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

	emitNumericFlowCards(result, {
		changedCard,
		risesAboveCard,
		dropsBelowCard,
		tokenName,
	}) {
		if( !result?.isChanged || !Number.isFinite(Number(result.newValue)) ) {
			return;
		}

		const tokens = { [tokenName]: Number(result.newValue) };
		if( changedCard ) {
			this._triggerFlowCard(changedCard, tokens);
		}

		if( !Number.isFinite(Number(result.oldValue)) ) {
			return;
		}

		const state = {
			previous: Number(result.oldValue),
			current: Number(result.newValue),
		};

		if( risesAboveCard ) {
			this._triggerFlowCard(risesAboveCard, tokens, state);
		}

		if( dropsBelowCard ) {
			this._triggerFlowCard(dropsBelowCard, tokens, state);
		}
	}

	updateDirectionalPowerState(key, power, cards, tokenName = 'power') {
		if( !Number.isFinite(power) ) {
			return;
		}

		const previous = this._flowStates[key];
		let next;
		if( previous === 'positive' && power > 25 ) {
			next = 'positive';
		} else if( previous === 'negative' && power < -25 ) {
			next = 'negative';
		} else if( power >= 50 ) {
			next = 'positive';
		} else if( power <= -50 ) {
			next = 'negative';
		} else {
			next = 'idle';
		}

		this._flowStates[key] = next;
		if( previous === undefined || previous === next ) {
			return;
		}

		const cardId = cards[next];
		if( cardId ) {
			this._triggerFlowCard(cardId, { [tokenName]: Math.abs(power) });
		}
	}

	updateProducingState(key, power, startedCard, stoppedCard) {
		if( !Number.isFinite(power) ) {
			return;
		}

		const previous = this._flowStates[key];
		const producing = previous === true ? power > 25 : power >= 50;
		this._flowStates[key] = producing;
		if( previous === undefined || previous === producing ) {
			return;
		}

		this._triggerFlowCard(producing ? startedCard : stoppedCard, { power });
	}

	updateConnectionState(online, onlineCard, offlineCard) {
		const previous = this.connectionOnline;
		this.connectionOnline = online;
		if( previous === undefined || previous === online ) {
			return;
		}

		this._triggerFlowCard(online ? onlineCard : offlineCard);
	}

	updateFaultState(key, values, cardId, source) {
		const activeCodes = Object.entries(values)
			.filter(([, value]) => Number(value) !== 0 && value !== undefined && value !== null && value !== '')
			.map(([name, value]) => `${name}:${value}`);
		this._updateFaultSignature(key, activeCodes, cardId, source);
	}

	updateActiveLowFaultState(key, values, cardId, source) {
		const activeCodes = [];
		for( const [name, value] of Object.entries(values) ) {
			const parsed = this.parseApiNumber(value);
			if( parsed === null || !Number.isInteger(parsed) || parsed < 0 || parsed > 0xFFFF ) {
				continue;
			}

			const activeMask = (~parsed) & 0xFFFF;
			if( activeMask !== 0 ) {
				activeCodes.push(`${ name }:0x${ activeMask.toString(16).padStart(4, '0') }`);
			}
		}

		this._updateFaultSignature(key, activeCodes, cardId, source);
	}

	_updateFaultSignature(key, activeCodes, cardId, source) {
		const signature = activeCodes.join(',');
		const previous = this._faultSignatures[key] ?? '';
		this._faultSignatures[key] = signature;

		if (signature && signature !== previous) {
			this._triggerFlowCard(cardId, { code: signature, source });
		}
	}

	async isHomeyLocalHourBetween(startHour, endHour, date = new Date()) {
		const timezone = await this.homey.clock.getTimezone();
		const hourPart = new Intl.DateTimeFormat('en-GB', {
			timeZone: timezone,
			hour: '2-digit',
			hourCycle: 'h23',
		}).formatToParts(date).find(part => part.type === 'hour');
		const hour = Number(hourPart?.value);

		return Number.isInteger(hour) && hour >= startHour && hour < endHour;
	}
}

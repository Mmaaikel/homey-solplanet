import { Inverter } from "../../lib/inverter.js";
import SolPlanetApi from "../../lib/SolPlanetApi.js";
import SolPlanetClient from "../../lib/SolPlanetClient.js";

class SolPlanet extends Inverter {

	fetchFailed = 0;
	checksFailed = 0;
	interval = 60;
	api;

	async onInit() {
		this.homey.log('SolPlanet has been initialized')

		const settings = this.getSettings();
		this.homey.log( 'Settings:', settings )

		// Init the API
		const solPlanetClient = new SolPlanetClient( settings.ip_address, settings.device_serial_number );
		this.api = new SolPlanetApi( solPlanetClient );

		this.homey.log('Api created', this.api );

		this.setDefaultInterval()

		super.onInit();

		// Capability migrations must not depend on the inverter being reachable
		// during app startup. Existing devices do not automatically receive newly
		// added capabilities from the driver manifest.
		try {
			const list = this.getCapabilities();
			this.homey.log("Current capabilities: ", list );

			const createCapabilities = [
				'meter_power',
				'meter_power_today',
				'measure_power.mppt1',
				'measure_power.mppt2',
				'measure_power.mppt3',
				'measure_power.phase1',
				'measure_power.phase2',
				'measure_power.phase3',
				'measure_voltage.phase1',
				'measure_voltage.phase2',
				'measure_voltage.phase3',
				'measure_current.phase1',
				'measure_current.phase2',
				'measure_current.phase3',
			];
			for( const capabilityId of createCapabilities ) {
				if( !this.hasCapability(capabilityId) ) {
					await this.addCapability(capabilityId);
					this.homey.log(`Added ${capabilityId} capability`);
				}
			}

			const removeCapabilities = ['meter_power.total', 'meter_power.today'];
			for( const capabilityId of removeCapabilities ) {
				if( this.hasCapability(capabilityId) ) {
					await this.removeCapability(capabilityId);
					this.homey.log(`Removed ${capabilityId} capability`);
				}
			}
		} catch (err) {
			this.homey.log(`Could not migrate device capabilities: ${ err.message }`);
		}

		// Refresh metadata when the inverter is reachable. A connection failure must
		// not prevent Homey from loading the device and its cached capability values.
		try {
			const inverterInfo = await this.api.getInverterInfo();
			this.homey.log('Inverter info fetched', inverterInfo );
			if( inverterInfo !== null ) {

				const primaryInverter = inverterInfo.getPrimaryInverter();

				await this.setSettings({
					solplanet_model_label: primaryInverter.model,
					solplanet_version_label: primaryInverter.cmv,
				})

				// Check battery
				if( primaryInverter.hasBatteryStorage() ) {
					this.homey.log("Inverter has battery storage");

					// Add battery_soc capability if not present
					if( !this.hasCapability('battery_soc') ) {
						await this.addCapability('battery_soc');
						this.homey.log("Added battery_soc capability");
					}

					const batteryInfo = await this.api.getBatteryInfo();
					if( batteryInfo !== null ) {
						this.homey.log("Battery info fetched", batteryInfo );
					}
				} else {
					this.homey.log("Inverter does not have battery storage");
				}
			}
		} catch (err) {
			this.homey.log(`Inverter unavailable during initialization; keeping cached values: ${ err.message }`);
		}

		await this.setAvailable();
	}

	setDefaultInterval() {
		const settings = this.getSettings();

		this.interval = settings.interval ?? 60;
		this.resetInterval( this.interval );
	}

	async onSettings({ newSettings = {}, changedKeys = [] } = {}) {
		const settings = {
			...this.getSettings(),
			...newSettings,
		};

		// Init the API with new settings
		const solPlanetClient = new SolPlanetClient( settings.ip_address, settings.device_serial_number );
		const newApi = new SolPlanetApi( solPlanetClient );

		// Validate
		const inverterInfo = await newApi.getInverterInfo();
		if( inverterInfo === null || inverterInfo.getPrimaryInverter() === null ) {
			throw new Error(
				`Could not fetch the correct data. Check the settings.`
			);
		}

		// Overwrite
		this.api = newApi;

		// Force production check when API key is changed
		this.checkProduction().catch( this.onError.bind( this ) );

		if( changedKeys.includes("interval") && settings.interval ) {
			this.interval = settings.interval;
			this.resetInterval( this.interval );
			this.homey.log(`Changed interval to ${ this.interval }`);
		}
	}

	async checkProduction() {
		this.homey.log("Checking production");

		if( this.api ) {
			try {
				const inverterInfo = await this.api.getInverterInfo();
				if( inverterInfo !== null ) {
					this.fetchFailed = 0;

					// Setting?
					const primaryInverter = inverterInfo.getPrimaryInverter();

					// Also get the data now
					const inverterData = await this.api.getInverterData();
					this.updateConnectionState(true, 'sol_device_online', 'sol_device_offline');
					this.updateInverterDiagnostics(inverterData);
					this.updateFaultState('inverter', {
						error: inverterData.err,
						warning: inverterData.wan,
					}, 'sol_inverter_fault', 'inverter');

					// Reset the checks failed
					if( this.checksFailed > 0 ) {
						this.checksFailed = 0;
						this.setDefaultInterval()
					}

					// FLG -> the current state of the device
					const deviceState = this.parseApiNumber(inverterData.flg, {
						invalidValues: [0xFF],
					});
					this.homey.log( `Current device state is: ${ deviceState }` );

					// Energy counters remain useful when the inverter is idle. Some
					// firmware versions also use different active-state values.
					const dailyProductionRaw = inverterData.etd ?? primaryInverter.etd;
					const dailyProductionValue = this.parseApiNumber(dailyProductionRaw, {
						divisor: 10,
						invalidValues: [0xFFFFFFFF],
					});
					const dailyProductionEnergy = dailyProductionValue === null ? null : Math.abs(dailyProductionValue);
					this.homey.log( `Daily production energy is: ${ dailyProductionEnergy }kWh` );

					if( dailyProductionEnergy !== null ) {
						this.setValueWithCatch("meter_power_today", dailyProductionEnergy);
					}

					const totalProductionRaw = inverterData.eto ?? primaryInverter.eto;
					const totalProductionValue = this.parseApiNumber(totalProductionRaw, {
						divisor: 10,
						invalidValues: [0xFFFFFFFF],
					});
					const totalProductionEnergy = totalProductionValue === null ? null : Math.abs(totalProductionValue);
					this.homey.log( `Total production energy is: ${ totalProductionEnergy }kWh` );

					if( totalProductionEnergy !== null ) {
						this.setValueWithCatch("meter_power", totalProductionEnergy);
					}

					if( deviceState !== 1 ) {
						if( deviceState === 0 ) {
							const result = this.setValueWithCatch('measure_power', 0 );
							this.emitNumericFlowCards(result, {
								risesAboveCard: 'sol_solar_power_rises_above',
								dropsBelowCard: 'sol_solar_power_drops_below',
								tokenName: 'power',
							});
							this.updateProducingState('solar', 0, 'sol_solar_production_started', 'sol_solar_production_stopped');
						}

						return;
					}

					// Temperature
					const currentTemperature = this.parseApiNumber(inverterData.tmp, {
						divisor: 10,
						invalidValues: [-32768],
					});
					this.homey.log( `Current inverter temperature is: ${ currentTemperature }` );

					if( currentTemperature !== null ) {
						this.setValueWithCatch("measure_temperature", currentTemperature);
					}

					// Current (w)
					const currentProductionPower = this.parseApiNumber(inverterData.pac, {
						invalidValues: [0xFFFFFFFF],
					});
					this.homey.log( `Current production power is: ${ currentProductionPower }W` );

					if( currentProductionPower !== null ) {
						const result = this.setValueWithCatch("measure_power", currentProductionPower);
						this.emitNumericFlowCards(result, {
							risesAboveCard: 'sol_solar_power_rises_above',
							dropsBelowCard: 'sol_solar_power_drops_below',
							tokenName: 'power',
						});
						this.updateProducingState('solar', currentProductionPower, 'sol_solar_production_started', 'sol_solar_production_stopped');
					}

					// Check if there is a battery
					if( primaryInverter.hasBatteryStorage() ) {

						// Get the battery info
						const batteryData = await this.api.getBatteryData();

						if( batteryData !== null ) {

							// Battery %
							const batterySoc = this.parseApiNumber(batteryData.soc, {
								invalidValues: [0xFFFF],
							});
							this.homey.log( `Battery percentage is: ${ batterySoc }%` );

							if( batterySoc !== null && batterySoc >= 0 && batterySoc <= 100 ) {
								const result = this.setValueWithCatch("battery_soc", batterySoc);
								this.emitNumericFlowCards(result, {
									changedCard: 'sol_battery_percentage_changed',
									risesAboveCard: 'sol_battery_rises_above',
									dropsBelowCard: 'sol_battery_drops_below',
									tokenName: 'battery_percentage',
								});
							}

							// The API reports negative=charging; invert to positive=charging
							const apiBatteryPower = this.parseApiNumber(batteryData.pb, {
								invalidValues: [-2147483648, 0xFFFFFFFF],
							});
							this.batteryPower = apiBatteryPower === null ? null : 0 - apiBatteryPower; // 0 - x avoids -0
							this.batteryStateOfHealth = this.parseApiNumber(batteryData.soh, {
								invalidValues: [0xFFFF],
							});
							this.updateDirectionalPowerState('battery', this.batteryPower, {
								positive: 'sol_battery_started_charging',
								negative: 'sol_battery_started_discharging',
								idle: 'sol_battery_became_idle',
							});
							this.updateActiveLowFaultState('battery', {
								error1: batteryData.eb1,
								error2: batteryData.eb2,
								error3: batteryData.eb3,
								error4: batteryData.eb4,
								warning1: batteryData.wb1,
								warning2: batteryData.wb2,
								warning3: batteryData.wb3,
								warning4: batteryData.wb4,
							}, 'sol_inverter_fault', 'battery');
						}
					}

					this.setAvailable().catch( this.onError.bind( this ) );
				} else {

					this.fetchFailed++;

					// Could not fetch the inverter info, maybe the device is offline. Set the device to unavailable
					// Offline!
					if( this.fetchFailed > 3 ) {
						this.log("Could not fetch the inverter info. Set the device to unavailable");
						await this.setIsOffline();
					}
				}
			} catch (err) {
				// Log the error
				this.onError( err );

				// Offline!
				await this.setIsOffline();

				if( this.checksFailed > 3 ) {
					// Change the interval to 5 minutes
					this.resetInterval( 5 * 60 );

					this.setValueWithCatch('measure_power', 0 );
				}
			}
		} else if ( !this.api ) {
			this.homey.log("SolPlanet could not be discovered on your network")

			await this.setUnavailable(
				"SolPlanet could not be discovered on your network"
			);
		}
	}

	async setIsOffline() {
		if( this.fetchFailed > 3 || this.checksFailed > 3 ) {
			this.updateConnectionState(false, 'sol_device_online', 'sol_device_offline');
		}

		if( await this.isHomeyLocalHourBetween(0, 3) ) {
			// Only reset daily production, not the cumulative meter_power
			this.setValueWithCatch( 'meter_power_today', 0 );
		}
	}

	onError (error) {
		const errorMessage = error.message;

		// If the error message contains the words 'not found' we have to stop the interval
		// This means the device is not there anymore and we should not do anything...
		if( errorMessage.toLowerCase().includes('not found') ) {
			this.homey.log('Device could not be found. Stop the interval');
			this.stopInterval()
			return
		}

		// Update the fail checks
		this.checksFailed++;
		this.homey.log(`Unavailable (${this.checksFailed}): ${errorMessage}`);
	}
}

export default SolPlanet

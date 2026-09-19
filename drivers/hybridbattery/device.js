import { Inverter } from "../../lib/inverter.js";
import SolPlanetApi from "../../lib/SolPlanetApi.js";
import SolPlanetClient from "../../lib/SolPlanetClient.js";
import _ from 'lodash'

class HybridBattery extends Inverter {

	checksFailed = 0;
	interval = 60;
	api;

	async onInit() {
		this.homey.log('HybridBattery has been initialized')

		const settings = this.getSettings();
		this.homey.log( 'Settings:', settings )

		// Init the API
		const solPlanetClient = new SolPlanetClient( settings.ip_address, settings.device_serial_number );
		this.api = new SolPlanetApi( solPlanetClient );

		this.homey.log('Api created', this.api );

		this.setDefaultInterval()

		super.onInit();

		try {
			const inverterInfo = await this.api.getInverterInfo();
			if( inverterInfo !== null ) {

				const primaryInverter = inverterInfo.getPrimaryInverter();

				await this.setSettings({
					solplanet_model_label: primaryInverter.model,
				})

				if( primaryInverter.hasBatteryStorage() ) {
					const batteryInfo = await this.api.getBatteryInfo();
					if( batteryInfo !== null ) {
						this.homey.log("Battery info fetched", batteryInfo );

						await this.setSettings({
							solplanet_battery_model_label: batteryInfo.battery?.manufactoty ?? 'Unknown',
						})

						const batteryInfoCapacity = batteryInfo.battery?.capacity ?? 'Unknown';
						await this.setSettings({
							solplanet_battery_info_capacity: batteryInfoCapacity,
						});
					}
				}
			}
		} catch (err) {
			this.homey.log(`Inverter unavailable during initialization; keeping cached values: ${ err.message }`);
		}

		await this.setAvailable();

		// Conditions
		// Register the condition card for checking if the window is open
		const batteryAboveCondition = this.homey.flow.getConditionCard('battery_above');

		batteryAboveCondition?.registerRunListener(async (args, state) => {
			const battery = this.getCapabilityValue('battery_soc');

			return battery >= args.percentage;
		});
	}

	setDefaultInterval() {
		const settings = this.getSettings();

		this.interval = settings.interval ?? 60;
		this.resetInterval( this.interval );
	}

	async onSettings({ newSettings, changedKeys}) {
		// Init the API with new settings
		const solPlanetClient = new SolPlanetClient( newSettings.ip_address, newSettings.device_serial_number );
		const newApi = new SolPlanetApi( solPlanetClient );

		// Validate
		const inverterInfo = await newApi.getInverterInfo();
		if( inverterInfo === null ) {
			throw new Error(
				`Could not fetch the correct data. Check the settings.`
			);
		}

		// Overwrite
		this.api = newApi;

		// Force production check when settings are changed
		this.checkProduction();

		if (changedKeys.includes("interval") && newSettings.interval) {
			this.resetInterval( newSettings.interval );
			this.homey.log(`Changed interval to ${newSettings.interval}`);
		}
	}

	async checkProduction() {
		this.homey.log("Checking production");

		if( this.api ) {
			try {

				const batteryData = await this.api.getBatteryData();

				if( batteryData !== null ) {

					// Reset the checks failed
					if( this.checksFailed > 0 ) {
						this.checksFailed = 0;
						this.setDefaultInterval()
					}

					// Battery power (W) - positive=charging, negative=discharging (matches Homey convention)
					const batteryPower = Number( _.parseInt( batteryData.pb ) );
					this.homey.log( `Battery power is: ${ batteryPower }W` );

					if( Number.isFinite(batteryPower) ) {
						this.setValueWithCatch("measure_power", batteryPower);
					}

					// Battery SOC (%)
					const batterySoc = Number( _.parseInt( batteryData.soc ) );
					this.homey.log( `Battery SOC is: ${ batterySoc }%` );

					if( Number.isFinite(batterySoc) ) {
						const resultBatterySoc = this.setValueWithCatch("battery_soc", batterySoc);

						if( resultBatterySoc?.isChanged ) {
							this._triggerFlowCard('battery_percentage_changed', { battery_percentage: batterySoc });
						}
					}

					// Battery charge today (kWh) - ebi is in 0.1 kWh
					const batteryChargeToday = Math.abs( Number( _.parseInt( batteryData.ebi ) / 10 ) );
					this.homey.log( `Battery charge today is: ${ batteryChargeToday }kWh` );

					if( Number.isFinite(batteryChargeToday) ) {
						const resultBatteryChargeToday = this.setValueWithCatch("meter_power.battery_charge_today", batteryChargeToday);
					}

					// Battery discharge today (kWh) - ebo is in 0.1 kWh
					const batteryDischargeToday = Math.abs( Number( _.parseInt( batteryData.ebo ) / 10 ) );
					this.homey.log( `Battery discharge today is: ${ batteryDischargeToday }kWh` );

					if( Number.isFinite(batteryDischargeToday) ) {
						this.setValueWithCatch("meter_power.battery_discharge_today", batteryDischargeToday);
					}

					this.setAvailable().catch( this.onError.bind( this ) );
				}
			} catch (err) {
				this.onError( err );

				if( this.checksFailed > 3 ) {
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

	onError (error) {
		const errorMessage = error.message;

		if( errorMessage.toLowerCase().includes('not found') ) {
			this.homey.log('Device could not be found. Stop the interval');
			this.stopInterval()
			return
		}

		this.checksFailed++;
		this.homey.log(`Unavailable (${this.checksFailed}): ${errorMessage}`);
	}
}

export default HybridBattery;

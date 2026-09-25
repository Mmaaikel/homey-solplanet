import Homey from 'homey';

class SolPlanet extends Homey.App {
	
	/**
	 * onInit is called when the app is initialized.
	 */
	async onInit() {
		this.registerFlowCards();
		this.log( 'SolPlanet has been initialized' );
	}

	registerFlowCards() {
		const thresholdTriggers = {
			sol_battery_rises_above: 'rises',
			sol_battery_drops_below: 'drops',
			sol_solar_power_rises_above: 'rises',
			sol_solar_power_drops_below: 'drops',
			battery_rises_above: 'rises',
			battery_drops_below: 'drops',
			hybrid_solar_power_rises_above: 'rises',
			hybrid_solar_power_drops_below: 'drops',
			hybrid_grid_import_rises_above: 'rises',
			hybrid_grid_export_rises_above: 'rises',
		};

		for (const [cardId, direction] of Object.entries(thresholdTriggers)) {
			this.homey.flow.getDeviceTriggerCard(cardId).registerRunListener(async (args, state) => {
				const threshold = Number(args.percentage ?? args.power);
				const previous = Number(state.previous);
				const current = Number(state.current);

				if (![threshold, previous, current].every(Number.isFinite)) {
					return false;
				}

				return direction === 'rises' ? previous <= threshold && current > threshold : previous >= threshold && current < threshold;
			});
		}

		const capabilityConditions = {
			sol_battery_above: ['battery_soc', 'percentage', (value, limit) => value >= limit],
			sol_battery_below: ['battery_soc', 'percentage', (value, limit) => value < limit],
			sol_solar_producing: ['measure_power', null, value => value > 25],
			sol_solar_power_above: ['measure_power', 'power', (value, limit) => value > limit],
			battery_above: ['battery_soc', 'percentage', (value, limit) => value >= limit],
			battery_below: ['battery_soc', 'percentage', (value, limit) => value < limit],
			battery_is_charging: ['measure_power', null, value => value > 25],
			battery_is_discharging: ['measure_power', null, value => value < -25],
			battery_is_idle: ['measure_power', null, value => Math.abs(value) <= 25],
			hybrid_solar_producing: ['measure_power', null, value => value > 25],
			hybrid_solar_power_above: ['measure_power', 'power', (value, limit) => value > limit],
			hybrid_grid_importing: ['measure_power.grid', null, value => value > 25],
			hybrid_grid_exporting: ['measure_power.grid', null, value => value < -25],
		};

		for (const [cardId, [capability, argument, predicate]] of Object.entries(capabilityConditions)) {
			this.homey.flow.getConditionCard(cardId).registerRunListener(async args => {
				const rawValue = args.device.getCapabilityValue(capability);
				if (rawValue === null || rawValue === undefined) {
					return false;
				}

				const value = Number(rawValue);
				if (!Number.isFinite(value)) {
					return false;
				}

				return predicate(value, argument ? Number(args[argument]) : undefined);
			});
		}

		const deviceValueConditions = {
			sol_battery_is_charging: device => Number(device.batteryPower) > 25,
			sol_battery_is_discharging: device => Number(device.batteryPower) < -25,
			sol_battery_is_idle: device => Number.isFinite(Number(device.batteryPower)) && Math.abs(Number(device.batteryPower)) <= 25,
		};

		for (const [cardId, predicate] of Object.entries(deviceValueConditions)) {
			this.homey.flow.getConditionCard(cardId).registerRunListener(async args => predicate(args.device));
		}

		for (const cardId of ['is_online', 'battery_is_online', 'hybrid_is_online']) {
			this.homey.flow.getConditionCard(cardId).registerRunListener(async args => (
				args.device.connectionOnline === true
			));
		}

		for (const cardId of ['sol_battery_soh_below', 'battery_soh_below']) {
			this.homey.flow.getConditionCard(cardId).registerRunListener(async args => {
				const stateOfHealth = Number(args.device.batteryStateOfHealth);
				return Number.isFinite(stateOfHealth) && stateOfHealth < Number(args.percentage);
			});
		}

		for (const cardId of ['sol_refresh_data', 'battery_refresh_data', 'hybrid_refresh_data']) {
			this.homey.flow.getActionCard(cardId).registerRunListener(async args => {
				await args.device.checkProduction();
				return true;
			});
		}
	}
	
}

export default SolPlanet;

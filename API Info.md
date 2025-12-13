# SolPlanet API Information

This document describes the API parameters returned by the SolPlanet inverter local API and how they map to Homey device capabilities.

---

## Inverter Data

Data retrieved via `getInverterData()` and `getInverterInfo()`.

| API Parameter | Description | Divisor | Unit | Capability (Standard) | Capability (With Battery) |
|---------------|-------------|---------|------|----------------------|---------------------------|
| `flg` | Device state flag. `0` = offline/sleeping, `1` = running/producing | - | - | Used for state check | Used for state check |
| `tmp` | Inverter internal temperature | 10 | °C | `measure_temperature` | `measure_temperature` |
| `pac` | Current AC power output from inverter (power being delivered) | 1 | W | `measure_power` | `measure_power.solar` |
| `etd` | Energy produced today (daily production counter, resets at midnight) | 10 | kWh | `meter_power` | `meter_power.solar_today` |
| `eto` | Energy produced total (lifetime production counter) | 10 | kWh | `meter_power.total` | `meter_power.solar_total` |
| `model` | Inverter model name (e.g., "ASW5000-S") | - | - | Settings label | Settings label |
| `cmv` | Communication module version / firmware version | - | - | Settings label | Settings label |
| `isn` | Inverter serial number (used as unique device identifier) | - | - | Device ID | Device ID |

---

## Meter Data

Data retrieved via `getMeterData()`. Only available on inverters with energy meter support.

| API Parameter | Description | Divisor | Unit | Capability (With Battery) |
|---------------|-------------|---------|------|---------------------------|
| `pac` | Current grid power. Positive = importing from grid, Negative = exporting to grid | 1 | W | `measure_power.grid` |
| `itd` | Grid import today (energy bought from grid today) | 100 | kWh | `meter_power.grid_import_today` |
| `otd` | Grid export today (energy sold to grid today) | 100 | kWh | `meter_power.grid_export_today` |
| `iet` | Grid import total (lifetime energy bought from grid) | 10 | kWh | `meter_power.grid_import_total` |
| `oet` | Grid export total (lifetime energy sold to grid) | 10 | kWh | `meter_power.grid_export_total` |

---

## Battery Data

Data retrieved via `getBatteryData()` and `getBatteryInfo()`. Only available on hybrid inverters with battery storage.

| API Parameter | Description | Divisor | Unit | Capability (Standard) | Capability (With Battery) |
|---------------|-------------|---------|------|----------------------|---------------------------|
| `soc` | State of Charge - current battery level | 1 | % | `battery_soc` | `battery_soc` |
| `pb` | Battery power. Positive = charging, Negative = discharging | 1 | W | - | `measure_power.battery` |
| `ebi` | Energy Battery In - total energy charged into battery (lifetime) | 10 | kWh | - | `meter_power.battery_charge_total` |
| `ebo` | Energy Battery Out - total energy discharged from battery (lifetime) | 10 | kWh | - | `meter_power.battery_discharge_total` |

### Battery Info (from `getBatteryInfo()`)

| API Parameter | Description | Used In |
|---------------|-------------|---------|
| `battery.manufactoty` | Battery manufacturer/model name (note: API has typo "manufactoty" instead of "manufacturer") | Settings label `solplanet_battery_model_label` |

---

## API Methods Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `getInverterInfo()` | `InverterInfo` object | Static inverter information (model, version, serial, battery support check) |
| `getInverterData()` | Raw data object | Real-time inverter measurements (power, temperature, state) |
| `getMeterData()` | Raw data object | Real-time grid meter measurements |
| `getBatteryInfo()` | Raw data object | Static battery information (manufacturer) |
| `getBatteryData()` | Raw data object | Real-time battery measurements (SOC, power, energy totals) |

---

## Helper Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `inverterInfo.getPrimaryInverter()` | Inverter object | Gets the main inverter from the inverter info response |
| `primaryInverter.hasBatteryStorage()` | Boolean | Returns `true` if the inverter has battery storage capability |

---

## Notes

1. **Divisors**: Raw API values need to be divided by the specified divisor to get the actual value in the correct unit.

2. **Negative Values**: The `etd` (energy today) field can occasionally return values that appear negative due to unsigned 16-bit integer overflow. Use `Math.abs()` to handle this.

3. **Grid Power Sign Convention**:
   - Positive `pac` (meter) = Importing power from the grid (consuming)
   - Negative `pac` (meter) = Exporting power to the grid (selling)

4. **Battery Power Sign Convention**:
   - Positive `pb` = Battery is charging (receiving power)
   - Negative `pb` = Battery is discharging (providing power)

5. **Device State (`flg`)**:
   - `0` = Inverter is offline or in sleep mode (typically at night)
   - `1` = Inverter is running and producing power

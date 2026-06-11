# SolPlanet API Information

This document describes the API parameters returned by the SolPlanet inverter local API and how they map to Homey device capabilities across the three drivers.

## Drivers Overview

| Driver | Homey Class | Energy Config | Description |
|--------|-------------|---------------|-------------|
| `solplanet` | `solarpanel` | `meterPowerExportedCapability: "meter_power"` | Standard inverters (no battery) |
| `hybridsolar` | `solarpanel` | `meterPowerExportedCapability: "meter_power"` | Hybrid inverter solar production + grid |
| `hybridbattery` | `battery` | `homeBattery: true` | Hybrid inverter battery storage |

---

## Inverter Data

Data retrieved via `getInverterData()` and `getInverterInfo()`.

| API Parameter | Description | Divisor | Unit | `solplanet` | `hybridsolar` | `hybridbattery` |
|---------------|-------------|---------|------|-------------|---------------|-----------------|
| `flg` | Device state flag. `0` = offline, `1` = running | - | - | State check | - | - |
| `tmp` | Inverter internal temperature | 10 | °C | `measure_temperature` | - | - |
| `pac` | Inverter AC power output (includes battery discharge for hybrid) | 1 | W | `measure_power` | - | - |
| `etd` | AC energy today (includes battery discharge for hybrid) | 10 | kWh | `meter_power_today` | - | - |
| `eto` | AC energy total (cumulative lifetime) | 10 | kWh | `meter_power` | - | - |
| `model` | Inverter model name (e.g., "ASW5000-S") | - | - | Settings label | Settings label | Settings label |
| `cmv` | Communication module version / firmware version | - | - | Settings label | Settings label | - |
| `isn` | Inverter serial number (used as unique device identifier) | - | - | Device `sid` | Device `sid` + `-solar` | Device `sid` + `-battery` |

---

## Meter Data

Data retrieved via `getMeterData()`. Only available on inverters with energy meter support.

| API Parameter | Description | Divisor | Unit | `solplanet` | `hybridsolar` | `hybridbattery` |
|---------------|-------------|---------|------|-------------|---------------|-----------------|
| `pac` | Current grid power. Positive = importing, Negative = exporting | 1 | W | - | `measure_power.grid` | - |
| `itd` | Grid import today (energy bought from grid) | 100 | kWh | - | `meter_power.grid_import_today` | - |
| `otd` | Grid export today (energy sold to grid) | 100 | kWh | - | `meter_power.grid_export_today` | - |
| `iet` | Grid import total (lifetime) | 10 | kWh | - | `meter_power.grid_import_total` | - |
| `oet` | Grid export total (lifetime) | 10 | kWh | - | `meter_power.grid_export_total` | - |

---

## Battery Data

Data retrieved via `getBatteryData()` and `getBatteryInfo()`. Only available on hybrid inverters with battery storage.

### PV/Solar Production (from Battery endpoint)

For hybrid inverters, pure solar production data comes from the battery endpoint (inverter endpoint `pac`/`eto`/`etd` include battery discharge).

| API Parameter | Description | Divisor | Unit | `solplanet` | `hybridsolar` | `hybridbattery` |
|---------------|-------------|---------|------|-------------|---------------|-----------------|
| `ppv` | PV/Solar power - current solar panel production | 1 | W | - | `measure_power` | - |
| `etdpv` | PV/Solar energy today (pure solar, excludes battery) | 10 | kWh | - | `meter_power.solar_today` | - |
| `etopv` | PV/Solar energy total (cumulative lifetime) | 10 | kWh | - | `meter_power` | - |
| `tb` | Inverter/battery temperature | 10 | °C | - | `measure_temperature` | - |

### Battery Status

| API Parameter | Description | Divisor | Unit | `solplanet` | `hybridsolar` | `hybridbattery` |
|---------------|-------------|---------|------|-------------|---------------|-----------------|
| `soc` | State of Charge - current battery level | 1 | % | `battery_soc` | - | `battery_soc` |
| `pb` | Battery power. Positive = charging, Negative = discharging | 1 | W | - | - | `measure_power` |
| `ebi` | Energy Battery In - charged today (resets at midnight) | 10 | kWh | - | - | `meter_power.battery_charge_today` |
| `ebo` | Energy Battery Out - discharged today (resets at midnight) | 10 | kWh | - | - | `meter_power.battery_discharge_today` |

### Battery Info (from `getBatteryInfo()`)

| API Parameter | Description | `solplanet` | `hybridsolar` | `hybridbattery` |
|---------------|-------------|-------------|---------------|-----------------|
| `battery.manufactoty` | Battery manufacturer/model (note: API typo) | - | - | Settings label `solplanet_battery_model_label` |

---

## API Methods Reference

| Method | Returns | Used By |
|--------|---------|---------|
| `getInverterInfo()` | `InverterInfo` object | `solplanet`, `hybridsolar`, `hybridbattery` |
| `getInverterData()` | Raw data object | `solplanet` only |
| `getMeterData()` | Raw data object | `hybridsolar` only |
| `getBatteryInfo()` | Raw data object | `hybridbattery` only |
| `getBatteryData()` | Raw data object | `hybridsolar`, `hybridbattery` |

---

## Helper Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `inverterInfo.getPrimaryInverter()` | Inverter object | Gets the main inverter from the inverter info response |
| `primaryInverter.hasBatteryStorage()` | Boolean | Returns `true` if the inverter has battery storage capability |

---

## Notes

1. **Divisors**: Raw API values need to be divided by the specified divisor to get the actual value in the correct unit.

2. **Negative Values**: Energy fields can occasionally return values that appear negative due to unsigned 16-bit integer overflow. Use `Math.abs()` to handle this.

3. **Grid Power Sign Convention**:
   - Positive `pac` (meter) = Importing power from the grid (consuming)
   - Negative `pac` (meter) = Exporting power to the grid (selling)

4. **Battery Power Sign Convention**:
   - Positive `pb` = Battery is charging (receiving power) — matches Homey convention
   - Negative `pb` = Battery is discharging (providing power)

5. **Device State (`flg`)**:
   - `0` = Inverter is offline or in sleep mode (typically at night)
   - `1` = Inverter is running and producing power

6. **Why hybrid uses battery endpoint for solar data**: The inverter endpoint fields `pac`, `eto`, `etd` include battery discharge energy mixed in. The battery endpoint provides `ppv`, `etopv`, `etdpv` which represent pure solar production only.

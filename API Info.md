# SolPlanet API Information

This document describes the API parameters returned by the SolPlanet inverter local API and how they map to Homey device capabilities across the three drivers.

## Drivers Overview

| Driver | Homey Class | Energy Config | Description |
|--------|-------------|---------------|-------------|
| `solplanet` | `solarpanel` | `meterPowerExportedCapability: "meter_power"` | Standard inverters (no battery) |
| `hybridsolar` | `solarpanel` | `meterPowerExportedCapability: "meter_power.solar_total"` | Hybrid inverter solar production + grid |
| `hybridbattery` | `battery` | `homeBattery: true` | Hybrid inverter battery storage |

---

## Inverter Data

Data retrieved via `getInverterData()` and `getInverterInfo()`.

| API Parameter | Description | Divisor | Unit | `solplanet` | `hybridsolar` | `hybridbattery` |
|---------------|-------------|---------|------|-------------|---------------|-----------------|
| `flg` | Device state flag. `0` = offline, `1` = running | - | - | State check | - | - |
| `tmp` | Inverter internal temperature | 10 | °C | `measure_temperature` | `measure_temperature` | - |
| `pac` | Inverter AC power output (can include battery discharge for hybrid) | 1 | W | `measure_power` | `measure_power.inverter` | - |
| `pac1`-`pac3` | Active power per AC phase | 1 | W | `measure_power.phase1`-`.phase3` | `measure_power.phase1`-`.phase3` | - |
| `vac[]` | Voltage per AC phase | 10 | V | `measure_voltage.phase1`-`.phase3` | `measure_voltage.phase1`-`.phase3` | - |
| `iac[]` | Current per AC phase | 10 | A | `measure_current.phase1`-`.phase3` | `measure_current.phase1`-`.phase3` | - |
| `vpv[]`, `ipv[]` | MPPT voltage and current, used to calculate power | 10, 100 | V, A | `measure_power.mppt1`-`.mppt3` | `measure_power.mppt1`-`.mppt3` | - |
| `etd` | Inverter production energy today | 10 | kWh | `meter_power_today` | `meter_power.solar_today` | - |
| `eto` | Inverter production energy total | 10 | kWh | `meter_power` | `meter_power.solar_total` | - |
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

Hybrid firmware does not use `ppv`, `etdpv`, and `etopv` consistently. On some models these values closely follow grid export rather than total PV production. HybridSolar therefore calculates live PV power from the inverter MPPT voltage/current arrays and uses the inverter production counters for energy.

| API Parameter | Description | Divisor | Unit | `solplanet` | `hybridsolar` | `hybridbattery` |
|---------------|-------------|---------|------|-------------|---------------|-----------------|
| `ppv` | Firmware-specific PV-related power | 1 | W | - | `measure_power.dongle_pv` | - |
| `vpv[]`, `ipv[]` | MPPT voltage/current used to calculate total PV array power | 10, 100 | V, A | - | `measure_power` | - |
| `etdpv` | Firmware-specific PV-related energy today | 10 | kWh | - | Diagnostic only | - |
| `etopv` | Firmware-specific PV-related energy total | 10 | kWh | - | Diagnostic only | - |
| `tb` | Battery temperature | 10 | °C | - | - | `measure_temperature` |

### Battery Status

| API Parameter | Description | Divisor | Unit | `solplanet` | `hybridsolar` | `hybridbattery` |
|---------------|-------------|---------|------|-------------|---------------|-----------------|
| `soc` | State of Charge - current battery level | 1 | % | `battery_soc` | - | `battery_soc` |
| `soh` | State of Health | 1 | % | Internal Flow state | - | `battery_soc.health` |
| `pb` | Battery power. Positive = charging, Negative = discharging | 1 | W | - | - | `measure_power` |
| `vb` | Battery voltage | 100 | V | - | - | `measure_voltage` |
| `cb` | Battery current | 10 | A | - | - | `measure_current` |
| `cli` | Charge current limit | 10 | A | - | - | `measure_current.charge_limit` |
| `clo` | Discharge current limit | 10 | A | - | - | `measure_current.discharge_limit` |
| `ebi` | Energy Battery In - charged today (resets at midnight) | 10 | kWh | - | - | `meter_power.battery_charge_today`, `meter_power.imported` |
| `ebo` | Energy Battery Out - discharged today (resets at midnight) | 10 | kWh | - | - | `meter_power.battery_discharge_today`, `meter_power.exported` |
| `pesp` | EPS/backup output power | 1 | W | - | - | `measure_power.eps` |
| `etdesp` | EPS energy today | 10 | kWh | - | - | `meter_power.eps_today` |
| `etoesp` | EPS energy total | 10 | kWh | - | - | `meter_power.eps_total` |

### Battery Info (from `getBatteryInfo()`)

| API Parameter | Description | `solplanet` | `hybridsolar` | `hybridbattery` |
|---------------|-------------|-------------|---------------|-----------------|
| `battery.manufactoty` | Battery manufacturer/model (note: API typo) | - | - | Settings label `solplanet_battery_model_label` |

---

## API Methods Reference

| Method | Returns | Used By |
|--------|---------|---------|
| `getInverterInfo()` | `InverterInfo` object | `solplanet`, `hybridsolar`, `hybridbattery` |
| `getInverterData()` | Raw data object | `solplanet`, `hybridsolar` |
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

6. **Hybrid solar sources**: Live PV production is the sum of each valid MPPT's `vpv × ipv`. Total inverter AC output remains available separately from `pac`. The `ppv` field is retained as a diagnostic because its meaning differs between firmware versions.

7. **Unavailable values**: Firmware sentinel values such as `0xFFFFFFFF`, `0xFFFF`, and `-32768` must be ignored rather than published as measurements.

8. **Battery fault words**: Battery error and warning words are active-low. A set bit means no fault; cleared bits identify active faults.

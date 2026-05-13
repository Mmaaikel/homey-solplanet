# SolPlanet Homey App - Change Plan

This document describes all changes made to the SolPlanet Homey app and how to recreate them from scratch.

---

## Part A: New Files to Create

### A1. Custom Capability: battery_soc

**File:** `.homeycompose/capabilities/battery_soc.json`

```json
{
  "type": "number",
  "title": {
    "en": "Battery State of Charge",
    "nl": "Batterij Laadtoestand",
    "da": "Batteri Ladningstilstand"
  },
  "units": {
    "en": "%"
  },
  "insights": true,
  "desc": {
    "en": "Battery state of charge in percent",
    "nl": "Batterij laadtoestand in procent",
    "da": "Batteri ladningstilstand i procent"
  },
  "chartType": "spline",
  "decimals": 0,
  "getable": true,
  "setable": false,
  "uiComponent": "sensor",
  "icon": "/assets/capabilities/battery_soc.svg",
  "min": 0,
  "max": 100
}
```

### A2. Capability Icon

**File:** `assets/capabilities/battery_soc.svg`

Create an SVG icon for the battery capability (copy from existing battery icon or create new).

---

### A3. New Driver: inverterwithbattery

Create the following folder structure:
```
drivers/inverterwithbattery/
├── assets/
│   ├── icon.svg
│   └── images/
│       ├── large.jpg
│       └── small.jpg
├── pair/
│   └── pair.html
├── device.js
├── driver.js
└── driver.compose.json
```

#### A3.1 driver.compose.json

```json
{
  "name": {
    "en": "Inverter with Battery",
    "nl": "Omvormer met Batterij"
  },
  "images": {
    "large": "/drivers/inverterwithbattery/assets/images/large.jpg",
    "small": "/drivers/inverterwithbattery/assets/images/small.jpg"
  },
  "connectivity": ["lan"],
  "platforms": ["local"],
  "class": "solarpanel",
  "pair": [
    { "id": "pair" },
    { "id": "list_devices", "template": "list_devices", "navigation": { "next": "add_devices" } },
    { "id": "add_devices", "template": "add_devices" }
  ],
  "capabilities": [
    "measure_power.solar",
    "measure_power.grid",
    "measure_power.battery",
    "battery_soc",
    "measure_temperature",
    "meter_power.solar_today",
    "meter_power.solar_total",
    "meter_power.grid_import_today",
    "meter_power.grid_export_today",
    "meter_power.grid_import_total",
    "meter_power.grid_export_total",
    "meter_power.battery_charge_total",
    "meter_power.battery_discharge_total"
  ],
  "capabilitiesOptions": {
    "measure_power.solar": {
      "title": { "en": "Inverter Output (current)", "nl": "Omvormer Output (huidig)" }
    },
    "measure_power.grid": {
      "title": { "en": "Grid Power (current)", "nl": "Netvermogen (huidig)" },
      "insights": true
    },
    "measure_power.battery": {
      "title": { "en": "Battery Power (current)", "nl": "Batterijvermogen (huidig)" },
      "insights": true
    },
    "battery_soc": {
      "title": { "en": "Battery State of Charge", "nl": "Batterij Laadtoestand" }
    },
    "measure_temperature": {
      "title": { "en": "Inverter Temperature", "nl": "Omvormer Temperatuur" }
    },
    "meter_power.solar_today": {
      "title": { "en": "Solar Energy Today", "nl": "Zonne-energie Vandaag" }
    },
    "meter_power.solar_total": {
      "title": { "en": "Solar Energy Total", "nl": "Zonne-energie Totaal" }
    },
    "meter_power.grid_import_today": {
      "title": { "en": "Grid Import Today", "nl": "Net Import Vandaag" }
    },
    "meter_power.grid_export_today": {
      "title": { "en": "Grid Export Today", "nl": "Net Export Vandaag" }
    },
    "meter_power.grid_import_total": {
      "title": { "en": "Grid Import Total", "nl": "Net Import Totaal" }
    },
    "meter_power.grid_export_total": {
      "title": { "en": "Grid Export Total", "nl": "Net Export Totaal" }
    },
    "meter_power.battery_charge_total": {
      "title": { "en": "Battery Charge Total", "nl": "Batterij Opladen Totaal" }
    },
    "meter_power.battery_discharge_total": {
      "title": { "en": "Battery Discharge Total", "nl": "Batterij Ontladen Totaal" }
    }
  },
  "settings": [
    { "id": "ip_address", "type": "text", "label": { "en": "SolPlanet inverter IP address" } },
    { "id": "device_serial_number", "type": "text", "label": { "en": "Device serial number (can be found at the online dashboard)" } },
    { "id": "interval", "type": "number", "value": 60, "min": 5, "max": 300, "label": { "en": "Fetch interval (in seconds)" } },
    { "id": "solplanet_model_label", "type": "label", "label": { "en": "Model name" }, "value": "" },
    { "id": "solplanet_version_label", "type": "label", "label": { "en": "Version" }, "value": "" },
    { "id": "solplanet_battery_model_label", "type": "label", "label": { "en": "Battery model" }, "value": "" }
  ]
}
```

#### A3.2 driver.js

Key features:
- Validates inverter has battery support during pairing
- Returns error if no battery storage detected
- Device name: "Solplanet (with Battery)"

#### A3.3 device.js

Key features:
- Extends `Inverter` base class
- Fetches inverter data, meter data, and battery data
- Capabilities updated:
  - `measure_power.solar` - Inverter AC output (pac)
  - `measure_power.grid` - Grid power from meter (pac)
  - `measure_power.battery` - Battery power (pb)
  - `battery_soc` - Battery state of charge (soc)
  - `meter_power.solar_today` - Daily solar energy (etd / 10)
  - `meter_power.solar_total` - Total solar energy (eto / 10)
  - `meter_power.grid_import_today` - Daily grid import (itd / 100)
  - `meter_power.grid_export_today` - Daily grid export (otd / 100)
  - `meter_power.grid_import_total` - Total grid import (iet / 10)
  - `meter_power.grid_export_total` - Total grid export (oet / 10)
  - `meter_power.battery_charge_total` - Total battery charge (ebi / 10)
  - `meter_power.battery_discharge_total` - Total battery discharge (ebo / 10)

#### A3.4 pair/pair.html

Key features:
- Form with IP address, device number, serial number inputs
- Uses async/await for validation
- Title: "Connect your inverter with battery"

---

## Part B: Modifications to Existing Files

### B1. Fix Invalid Capability: measure_battery

**Problem:** The `measure_battery` capability is not valid for the "solarpanel" device class.

**Files changed:**

1. `drivers/solplanet/driver.compose.json`
   - Replace `measure_battery` with `battery_soc` in capabilities array
   - Replace `measure_battery` with `battery_soc` in capabilitiesOptions

2. `drivers/solplanet/device.js`
   - Change `setValueWithCatch("measure_battery", ...)` to `setValueWithCatch("battery_soc", ...)`
   - Add dynamic capability registration in `onInit()`:
     ```javascript
     if( !this.hasCapability('battery_soc') ) {
         await this.addCapability('battery_soc');
         this.homey.log("Added battery_soc capability");
     }
     ```

### B2. Fix Pairing Page JavaScript

**Problem:** Pairing fails with "Cannot read properties of null" and page doesn't transition.

**Files changed:**

1. `drivers/solplanet/pair/pair.html`
2. `drivers/inverterwithbattery/pair/pair.html`

Replace the promise chain with async/await:
```javascript
const onConnect = async (event) => {
    event.preventDefault();
    Homey.showLoadingOverlay();

    const ipAddress = document.getElementById("ip_address").value;
    const deviceNr = document.getElementById("device_nr").value;
    const deviceSerialNr = document.getElementById("device_serial_number").value;

    try {
        const result = await Homey.emit("validate", { ipAddress, deviceNr, deviceSerialNr });
        Homey.hideLoadingOverlay();

        if (result && result.error) {
            Homey.alert(result.error);
            return;
        }

        Homey.showView("list_devices");
    } catch (error) {
        Homey.hideLoadingOverlay();
        Homey.alert(error.message);
    }
};
```

### B3. Update Energy Labels

**File:** `drivers/solplanet/driver.compose.json`

```json
"meter_power": {
    "title": { "en": "Energy (today)", "nl": "Energie (vandaag)" }
},
"meter_power.total": {
    "title": { "en": "Energy Total", "nl": "Energie Totaal" }
}
```

### B4. Add Energy Configuration for Battery

**File:** `drivers/solplanet/driver.compose.json`

Add the energy section to enable internal battery support:

```json
"energy": {
    "batteries": ["INTERNAL"]
}
```

### B5. Fix Negative Solar Energy Values

**Problem:** Solar Energy Today shows negative values due to integer overflow.

**Files changed:**

1. `drivers/solplanet/device.js`
   ```javascript
   const dailyProductionEnergy = Math.abs( Number( _.parseInt( primaryInverter.etd ) / 10 ) );
   ```

2. `drivers/inverterwithbattery/device.js`
   ```javascript
   const solarEnergyToday = Math.abs( Number( _.parseInt( primaryInverter.etd ) / 10 ) );
   ```

---

## Summary: All Files

### New Files
| File | Description |
|------|-------------|
| `.homeycompose/capabilities/battery_soc.json` | Custom battery SOC capability |
| `assets/capabilities/battery_soc.svg` | Battery capability icon |
| `drivers/inverterwithbattery/driver.compose.json` | Driver configuration |
| `drivers/inverterwithbattery/driver.js` | Driver pairing logic |
| `drivers/inverterwithbattery/device.js` | Device logic with meter/battery data |
| `drivers/inverterwithbattery/pair/pair.html` | Pairing UI |
| `drivers/inverterwithbattery/assets/*` | Icons and images |

### Modified Files
| File | Changes |
|------|---------|
| `drivers/solplanet/driver.compose.json` | Battery capability, energy labels |
| `drivers/solplanet/device.js` | Battery capability, Math.abs fix, dynamic capability |
| `drivers/solplanet/pair/pair.html` | Async/await pairing fix |

---

## Data Sources Reference

| Value | API Field | Divisor | Unit |
|-------|-----------|---------|------|
| Inverter power | `primaryInverter.pac` | 1 | W |
| Solar energy today | `primaryInverter.etd` | 10 | kWh |
| Solar energy total | `primaryInverter.eto` | 10 | kWh |
| Grid power | `meterData.pac` | 1 | W |
| Grid import today | `meterData.itd` | 100 | kWh |
| Grid export today | `meterData.otd` | 100 | kWh |
| Grid import total | `meterData.iet` | 10 | kWh |
| Grid export total | `meterData.oet` | 10 | kWh |
| Battery SOC | `batteryData.soc` | 1 | % |
| Battery power | `batteryData.pb` | 1 | W |
| Battery charge total | `batteryData.ebi` | 10 | kWh |
| Battery discharge total | `batteryData.ebo` | 10 | kWh |

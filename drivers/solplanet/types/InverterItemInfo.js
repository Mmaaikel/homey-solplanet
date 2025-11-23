import _ from 'lodash'

class InverterItemInfo {

    isn; // Inverter serial number
    add; // Address value
    safety; // Safety code
    rate; // Rate value
    msw; // Main software version
    ssw; // Slave software version
    tsw; // Third software version
    pac; // Current power output in W
    etd; // Today's energy production in 0.1 kWh
    eto; // Total energy production in 0.1 kWh # codespell:ignore eto
    err; // Error code
    cmv; // Communication version
    mty; // Device model type code
    model; // Device model name

    constructor( data ) {
        this.isn = data.isn;
        this.add = data.add;
        this.safety = data.safety;
        this.rate = data.rate;
        this.msw = data.msw;
        this.ssw = data.ssw;
        this.tsw = data.tsw;
        this.pac = data.pac;
        this.etd = data.etd;
        this.eto = data.eto;
        this.err = data.err;
        this.cmv = data.cmv;
        this.mty = data.mty;
        this.model = data.model;
    }

    hasBatteryStorage() {
        if( this.mty === undefined || this.mty === 'xxx' ) {
            return false;
        }

        const batteryModels = [ 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ];
        if( batteryModels.includes( this.mty ) ) {
            return true;
        }

        if( _.startsWith( this.mty, 'BE' ) ) {
            return true;
        }

        return false;
    }
}

export default InverterItemInfo
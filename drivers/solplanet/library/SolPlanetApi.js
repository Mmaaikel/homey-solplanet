import InverterData from '../types/InverterData.js';
import InverterInfo from '../types/InverterInfo.js';
import MeterData from '../types/MeterData.js';
import MeterInfo from '../types/MeterInfo.js';
import BatteryInfo from '../types/BatteryInfo.js';
import BatteryData from '../types/BatteryData.js';

class SolPlanetApi {

    client;
    name = "SolPlanet"

    constructor( client ) {
        this.client = client;
    }

    async validate() {
        const inverterInfo = await this.getInverterInfo();
        return inverterInfo !== null;
    }

    async getInverterInfo() {
        const url = this.client.createUrl( 2, 'info' );
        const data = await this.client.fetch( url );
        if( data !== null && data?.inv ) {
            return new InverterInfo( data );
        }

        return null;
    }

    async getInverterData() {
        const url = this.client.createUrl( 2, 'data' );
        const data = await this.client.fetch( url );
        if( data !== null && data?.tim && data.tim !== '' && data.tim !== '19700101000011' ) {
             return new InverterData( data );
        }

        return null;
    }

    async getMeterInfo() {
        const url = this.client.createUrl( 3, 'info' );
        const data = await this.client.fetch( url );

        return new MeterInfo( data );
    }

    async getMeterData() {
        const url = this.client.createUrl( 3, 'data' );
        const data = await this.client.fetch( url );

        return new MeterData( data );
    }

    async getBatteryInfo() {
        const url = this.client.createUrl( 4, 'info' );
        const data = await this.client.fetch( url );
        if( data !== null && data?.isn !== "xxx") {
            return new BatteryInfo( data );
        }

        return null
    }

    async getBatteryData() {
        const url = this.client.createUrl( 4, 'data' );
        const data = await this.client.fetch( url );

        return new BatteryData( data );
    }
}

export default SolPlanetApi
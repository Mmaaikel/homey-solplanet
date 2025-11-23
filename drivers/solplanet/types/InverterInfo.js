import _ from 'lodash'
import InverterItemInfo from './InverterItemInfo.js';

class InverterInfo {

    inv; // List of inverter info items
    num; // Number of inverters

    constructor( data ) {
        this.num = data.num;

        this.inv = _.map( data.inv, ( item ) => {
            return new InverterItemInfo( item );
        });
    }

    getPrimaryInverter() {
        if( this.inv.length > 0 ) {
            return this.inv[ 0 ];
        }

        return null;
    }
}

export default InverterInfo
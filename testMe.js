const PIFI = require('./pi802-11Class.js');

var pifi = new PIFI();
var promise = pifi.updateAll();
promise.then((result)=>{
    console.log('wireless config follows:');
    console.dir(pifi.config, {depth: null});
    console.log('Available Hubs follows:');
    console.dir(pifi.availableNetworks,{depth:null});
});
console.log('setting up event consumers...');
pifi.on('iNetReachable', (state)=>{
    if(state == true){
        console.log((new Date()).toLocaleTimeString() + ' Update! Internet connection has changed to OKAY!');
        } else {
            console.log((new Date()).toLocaleTimeString() + ' ERROR Internet connection is not reachable');
        }
});

pifi.on('essiUpdate', ()=>{
    console.log((new Date()).toLocaleTimeString() + ' Update event fired for wireless hub list:');
    console.dir(pifi.availableNetworks, {depth: null});
});

console.log('setting up timers...');
console.log('\tChecking connection to Internet every 5 minutes...');
setInterval(()=>{
    pifi.checkInternetConnection();
}, 300000);

console.log('\tChecking for new wirless hubs every 15 seconds...');
setInterval(()=>{
    pifi.getWirlessHubList();
}, 15000);


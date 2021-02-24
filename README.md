# pi802-11Class
802.11x wireless node.js class for Raspberry Pi zeero W
## To Install and test
* type `git clone https://github.com/RuckerGauge/pi802.11.git`
* type `cd pi802.11`
* type `npm install`
* type `node testMe` To start test app

## To make a wireless connection
Setup class as shown in testMe.js.  Then:
 1) Call **updateAll()** method.
 2) Look inside **availableNetworks** object to find a list of wireless hubs you can connect to.
 3) call **setNet_WPAx(ssid, password)** to connect to a hub. 
 ---
 User must be in the netdev group to access the wpa_cli utility used by this class.

 * Your hub's wireless passwords must be 8 characters or more.  
 * Support for enterprise level security (RADIUS server) was disabled in last major update on 2/8/2019 due to lack of demand.

 See testMe.js for more usage examples.  
/*
    Web request URL's
*/

var APIBaseURL = 'https://api3.arctic-network.com/v1/'

var APIModsURL = 'mods'

var APIServersURL = 'servers/'

var APIPlayerURL = 'player/'

var APIValidatePlayerURL = 'player/validate/'

var APINotificationURL = 'notification'

var APIModHashlistURL = 'mod/hashlist/'

var STATICFILESERVE = 'http://webstorage1.gaming-provider.com/dwcentral/ArtOfRP/modpack/@AORv2_ArtOfRp.de/'

Array.prototype.extend = function (other_array) {
    /* you should include a test to check whether other_array really is an array */
    other_array.forEach(function(v) {this.push(v)}, this);
}



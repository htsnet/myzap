function pegaDataHora() {
    var today = new Date();
    var date = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2, '0')+'-'+String(today.getDate()).padStart(2, '0') + ' ' + String(today.getHours()).padStart(2, '0') + ':' + String(today.getMinutes()).padStart(2, '0') + ':' + String(today.getSeconds()).padStart(2, '0') + ': ';
    return date;
}

function getSubstrings(str) {
    if(str.length > 60) {
      return str.substring(0, 30) + str.substring(str.length - 30); 
    } else {
      return str;
    }
  }

  //function to wait x ms
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function toArray(msg) {
  if (Array.isArray(msg))
    return msg.slice();
  var res = [];
  if (typeof msg === 'string') {
    for (var i = 0; i < msg.length; i++) {
      var c = msg.charCodeAt(i);
      var hi = c >> 8;
      var lo = c & 0xff;
      if (hi)
        res.push(hi, lo);
      else
        res.push(lo);
    }
  } else {
    for (var i = 0; i < msg.length; i++)
      res[i] = msg[i] | 0;
  }
  return res;
}
exports.toArray = toArray;

function toHex32(msg) {
  var res = '';
  for (var i = 0; i < msg.length; i++)
    res += zero8(msg[i].toString(16));
  return res;
}
exports.toHex32 = toHex32;

function zero6(word) {
  if (word.length === 5)
    return '0' + word;
  else if (word.length === 4)
    return '00' + word;
  else if (word.length === 3)
    return '000' + word;
  else if (word.length === 2)
    return '0000' + word;
  else if (word.length === 1)
    return '00000' + word;
  else
    return word;
}
exports.zero6 = zero6;

function zero8(word) {
  if (word.length === 7)
    return '0' + word;
  else if (word.length === 6)
    return '00' + word;
  else if (word.length === 5)
    return '000' + word;
  else if (word.length === 4)
    return '0000' + word;
  else if (word.length === 3)
    return '00000' + word;
  else if (word.length === 2)
    return '000000' + word;
  else if (word.length === 1)
    return '0000000' + word;
  else
    return word;
}
exports.zero8 = zero8;

function alphabeticNumeration(number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const result = [];
  let currentNumber = number;

  while (currentNumber > 0) {
    currentNumber--;
    result.unshift(alphabet[currentNumber % 26]);
    currentNumber = Math.floor(currentNumber / 26);
  }

  return result.join('');
}

function getAlphabeticArray(number) {
  const result = [];
  for (let i = 1; i <= number; i++) {
    result.push(alphabeticNumeration(i));
  }
  return result;
}



module.exports = getAlphabeticArray;

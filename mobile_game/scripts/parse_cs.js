const fs = require('fs');
const buf = fs.readFileSync('d:/sync/project/Spectromancer/Inf/Cs.spe');
console.log('Total 64-byte records:', buf.length / 64);
for (let i = 0; i < 10; i++) {
  const slice = buf.subarray(i * 64, (i + 1) * 64);
  const ints = [];
  for (let j = 0; j < 64; j += 4) {
    ints.push(slice.readInt32LE(j));
  }
  console.log(`Stage ${i + 1}:`, ints);
}

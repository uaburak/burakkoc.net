const fs = require('fs');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const { JSDOM } = require('jsdom');

const { window } = new JSDOM();
global.window = window;
global.document = window.document;
global.self = window;
global.Blob = window.Blob;
global.FileReader = window.FileReader;

const buffer = fs.readFileSync('./public/StickmanGLB/running.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  gltf.animations.forEach(clip => {
    clip.tracks.forEach(track => {
      if (track.name.toLowerCase().includes('position')) {
        console.log(`Track: ${track.name}, Values: ${track.values.length/3}, Time length: ${track.times.length}, Duration: ${clip.duration}`);
        // Let's print the first and last position
        const v = track.values;
        console.log(`  Start: [${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)}]`);
        console.log(`  End:   [${v[v.length-3].toFixed(2)}, ${v[v.length-2].toFixed(2)}, ${v[v.length-1].toFixed(2)}]`);
      }
    });
  });
});

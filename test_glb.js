const fs = require('fs');

const data = fs.readFileSync('public/StickmanGLB/running.glb');

// The first 12 bytes are the GLB header:
// uint32 magic
// uint32 version
// uint32 length
const magic = data.readUInt32LE(0);
const version = data.readUInt32LE(4);
const length = data.readUInt32LE(8);

console.log(`Magic: ${magic.toString(16)}, Version: ${version}, Length: ${length}`);

// Chunk 0: JSON
const chunk0Length = data.readUInt32LE(12);
const chunk0Type = data.readUInt32LE(16);
const jsonString = data.toString('utf8', 20, 20 + chunk0Length);

const gltf = JSON.parse(jsonString);
console.log("Nodes:", gltf.nodes ? gltf.nodes.length : 0);
console.log("Animations:", gltf.animations ? gltf.animations.length : 0);

if (gltf.animations) {
  gltf.animations.forEach((anim, i) => {
    console.log(`Animation ${i}: ${anim.name}, Channels: ${anim.channels.length}`);
    let scaleChannels = 0;
    let posChannels = 0;
    let hipsPos = false;
    anim.channels.forEach(ch => {
      if (ch.target.path === 'scale') scaleChannels++;
      if (ch.target.path === 'translation') posChannels++;
      
      const targetNode = gltf.nodes[ch.target.node];
      if (ch.target.path === 'translation' && targetNode.name && targetNode.name.toLowerCase().includes('hips')) {
        hipsPos = true;
      }
    });
    console.log(`  Scale channels: ${scaleChannels}, Translation channels: ${posChannels}, Hips translation: ${hipsPos}`);
  });
}

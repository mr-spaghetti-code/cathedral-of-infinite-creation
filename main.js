import * as THREE from 'three';
import ForceGraph3D from '3d-force-graph';

import TWEEN from '@tweenjs/tween.js'

import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

let sky;
const init_node_amount = 25;
const max_nodes = 1000;

let click_history = [];

const startButton = document.getElementById( 'startButton' );
startButton.addEventListener( 'click', init );

const aboutButton = document.getElementById( 'aboutButton' );
aboutButton.addEventListener( 'click', showAbout );

const aboutText = document.getElementById('aboutText');
const introText = document.getElementById('introText');


let showingAbout = false;

function showAbout() {
    if (showingAbout) {
        introText.style.display = 'block';
        aboutText.style.display = 'none';
        aboutButton.textContent = "About"    
        showingAbout = false;
    } else {
        introText.style.display = 'none';
        aboutText.style.display = 'block'; 
        aboutButton.textContent = "Back to Intro"
        showingAbout = true;  
    }
}

const promptOverlay = document.getElementById('prompt');

function getSkyVideo() {
    const geometry = new THREE.SphereGeometry( 5, 60, 40 );
    geometry.scale( - 500, 500, 500 );
    const video = document.getElementById( 'video' );
    video.play();
    const texture = new THREE.VideoTexture( video );
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial( { map: texture } );

    const mesh = new THREE.Mesh( geometry, material );
    return mesh
}

function playEffect(effect) {
    const listener = new THREE.AudioListener();

    const audio = new THREE.Audio( listener );
    
    let water_files = [
        "drop1.mp3",
        "drop2.mp3",
        "drop3.mp3"
    ]
    
    let click_files = [
        'breath-1.mp3',
        'breath-2.mp3',
        'breath-3.mp3',
        'breath-4.mp3',
        'breath-5.mp3',
        'breath-6.mp3',
        'breath-7.mp3'
    ]

    // If effect is 'water', play water effect, else play click effect
    let file = effect == 'water' ? water_files[Math.floor(Math.random() * water_files.length)] : click_files[Math.floor(Math.random() * click_files.length)]

    if ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) {

        const loader = new THREE.AudioLoader();
        loader.load( file, function ( buffer ) {

            audio.setBuffer( buffer );
            audio.play();

        } );

    } else {

        const mediaElement = new Audio( file );
        mediaElement.play();

        audio.setMediaElementSource( mediaElement );

    }

}

function playAudio(file) {
    const listener = new THREE.AudioListener();

    const audio = new THREE.Audio( listener );
    
    if ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) {

        const loader = new THREE.AudioLoader();
        loader.load( file, function ( buffer ) {

            audio.setBuffer( buffer );
            audio.play();

        } );

    } else {

        const mediaElement = new Audio( file );
        mediaElement.play();

        audio.setMediaElementSource( mediaElement );

    }

}

function init() {


    startButton.textContent = "Loading..."
    const overlay = document.getElementById( 'overlay' );
    
    
    playAudio('music.mp3')

    const jsonUrl = 'network_new_format_100.json'
    fetch(jsonUrl).then(r => r.json()).then(json => {
        overlay.remove();
        document.getElementById('backgroundvideo').remove();
        let { nodes, links } = json

        const nodes_shuffled = nodes.sort( () => Math.random() - 0.5);

        let sliced_nodes = nodes_shuffled.slice(0, init_node_amount)

        let init_graph_data = {
            "nodes": sliced_nodes,
            "links": []
        }

        let sliced_nodes_list = sliced_nodes.map(node => node["id"])
    
        sliced_nodes.forEach(element => {
            let l = links[element["id"]]
            l.forEach(link => {
                if (sliced_nodes_list.includes(link[0])) {
                    init_graph_data.links.push(
                        {
                            "source" : element["id"],
                            "target" : link[0],
                            "strength" : link[1]
                        }
                    )
                }
            });
        });

        const Graph = new ForceGraph3D()
        (document.getElementById('3d-graph'))
            .graphData(init_graph_data)
            // .nodeLabel('prompt')
            .linkOpacity([0.05])
            .linkDirectionalParticles("strength")
            .linkDirectionalParticleSpeed(d => d.strength * 0.001)
            .linkDirectionalParticleWidth(0.2)
            .cameraPosition({ z: 200 })
            .showNavInfo(true)
            .d3VelocityDecay(0.85)
            .nodeThreeObject(node => {
                const sprite = new THREE.Sprite();
                function loadTexture(url) {
                    return new Promise(resolve => {
                      new THREE.TextureLoader().load(url, resolve)
                    })
                }
                loadTexture(node.img_url).then(texture => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    const material = new THREE.SpriteMaterial({ map: texture });
                    sprite.material = material;
                    let img_height = texture.source.data.height;
                    let img_width = texture.source.data.width;

                    const y_scale = 10
                    const x_scale = y_scale * img_width / img_height;

                    sprite.scale.set(x_scale, y_scale, 1)
                })

                return sprite;
            })
            .onNodeClick(node => {
            

                click_history.push(node)
                let previous_node_clicked = click_history[click_history.length - 2]

                if (node.id != previous_node_clicked && previous_node_clicked != undefined) {
                    playEffect('click')
                    promptOverlay.classList.toggle("show");
                    // Unfix previous node position
                    delete previous_node_clicked.fx;
                    delete previous_node_clicked.fy;
                    delete previous_node_clicked.fz;

                }

                const distance = 20;
                const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
      
                const newPos = node.x || node.y || node.z
                  ? { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }
                  : { x: 0, y: 0, z: distance }; // special case if node is in (0,0,0)
      
                Graph.cameraPosition(
                  newPos, // new position
                  node, // lookAt ({ x, y, z })
                  3000  // ms transition duration
                );

                promptOverlay.innerHTML = node.prompt;
                // Add fade-in class to overlay
                promptOverlay.classList.toggle("show");

                // Fix node position
                node.fx = node.x; 
                node.fy = node.y; 
                node.fz = node.z;
              });
      
        
        const bloomPass = new UnrealBloomPass();
        bloomPass.strength = 0;
        bloomPass.radius = 1;
        bloomPass.threshold = 0;
        Graph.postProcessingComposer().addPass(bloomPass);

        Graph.controls().maxDistance = 1000;
        
        document.getElementById('3d-graph').style.top = 0;
        document.getElementById('3d-graph').style.left = 0;
        document.getElementById('3d-graph').style.position = 'absolute';
        document.getElementById('3d-graph').style.width = '100%';
        document.getElementById('3d-graph').style.height = '100%';  
        
        

        elementResizeDetectorMaker().listenTo(
            document.getElementById('3d-graph'),
            el => Graph.width(el.offsetWidth)
          );
      

        Graph.d3Force('charge').strength(-150);
        Graph.d3Force('center').strength(0.1);
        Graph.controls().movementSpeed = 100;
        
        let counter = init_node_amount + 1

        // Adds new nodes every 5-10 seconds
        setInterval(() => {
            if (counter < max_nodes) {
                let new_node = nodes[counter]
                init_graph_data.nodes.push(new_node)
                let new_links = links[new_node["id"]]
                let sliced_nodes_list = sliced_nodes.map(node => node["id"])
                new_links.forEach(link => {
                    if (sliced_nodes_list.includes(link[0])) {
                        init_graph_data.links.push(
                            {
                                "source" : new_node["id"],
                                "target" : link[0],
                                "strength" : link[1]
                            }
                        )
                    }
                });
                counter += 1

                Graph.graphData(init_graph_data)
                
                var tween_in = new TWEEN.Tween( bloomPass )
                    .to( {strength : 0.5 }, 250 )
                    .easing( TWEEN.Easing.Quadratic.Out )
                    .start()
                var tween_out = new TWEEN.Tween( bloomPass )
                    .to( {strength : 0 }, 250 )
                    .easing( TWEEN.Easing.Quadratic.In )
                
                tween_in.chain(tween_out)

                playEffect('water')
                
            }
          }, Math.floor(Math.random() * (10000 - 5000 + 1) + 5000));


          sky = getSkyVideo()

          
          Graph.scene().add(sky)
      
          // Runs every frame
          setInterval(() => { 
            TWEEN.update();
          }, 1000 / 60 );

    })
}
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const AvatarViewer = forwardRef((props, ref) => {
    const containerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // ★ 1. 加回選單需要的狀態
    const [voiceList, setVoiceList] = useState([]);
    const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);

    // ★ 2. 閉嘴技術需要的計時器管理
    const timersRef = useRef({
        mouth: null,
        expression: null
    });

    // Three.js refs
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const avatarGroupRef = useRef(null);
    const clockRef = useRef(new THREE.Clock());
    
    const partsRef = useRef({
        rightArm: null, leftArm: null,
        rightForeArm: null, leftForeArm: null,
        rightEyeBone: null, leftEyeBone: null,
        morphTargetMesh: null,
    });

    const morphIndicesRef = useRef({
        speech: [], subtle: [], blink: null, squint: [],
    });

    const requestRef = useRef(null);
    const isMountedRef = useRef(true);

    // 黃金姿勢
    const POSE = { sZ: 0, sY: -0.84, sX: 1.2, eX: 0, eY: 0.26 };
    const MODEL_URL = 'https://models.readyplayer.me/6932ab3f036a7b8f73fc5a46.glb';

    // ★ 3. 載入聲音列表 (Chrome 需要 onvoiceschanged)
    useEffect(() => {
        const loadVoices = () => {
            const allVoices = window.speechSynthesis.getVoices();
            // 抓出所有中文聲音
            const zhVoices = allVoices.filter(v => v.lang.includes('zh') || v.lang.includes('TW') || v.lang.includes('CN'));
            
            setVoiceList(zhVoices);

            // 預設幫你選一個好聽的女聲 (如果有的話)
            const defaultIndex = zhVoices.findIndex(v => 
                v.name.includes("Google 國語") || 
                v.name.includes("Hanhan") || 
                v.name.includes("Yating")
            );
            if (defaultIndex !== -1) setSelectedVoiceIndex(defaultIndex);
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        return () => { window.speechSynthesis.onvoiceschanged = null; }
    }, []);

    // 初始化 3D 環境
    useEffect(() => {
        isMountedRef.current = true;
        
        const init = () => {
            if (!containerRef.current) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;

            const scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x1a1a1a, 0.02);
            sceneRef.current = scene;

            const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
            hemiLight.position.set(0, 20, 0);
            scene.add(hemiLight);

            const keyLight = new THREE.DirectionalLight(0xffeedd, 1.5);
            keyLight.position.set(2, 5, 5);
            keyLight.castShadow = true;
            keyLight.shadow.mapSize.set(1024, 1024);
            scene.add(keyLight);

            const rimLight = new THREE.SpotLight(0x4455ff, 2.0);
            rimLight.position.set(-2, 5, -5);
            scene.add(rimLight);

            const plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: 0.3 }));
            plane.rotation.x = -Math.PI / 2;
            plane.receiveShadow = true;
            scene.add(plane);

            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(width, height);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            if (containerRef.current) containerRef.current.appendChild(renderer.domElement);
            rendererRef.current = renderer;

            const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            camera.position.set(0, 1.55, 0.6);
            cameraRef.current = camera;

            const controls = new OrbitControls(camera, renderer.domElement);
            controls.target.set(0, 1.5, 0);
            controls.enablePan = false;
            controls.update();

            const loader = new GLTFLoader();
            loader.load(MODEL_URL, (gltf) => {
                if (!isMountedRef.current) return;
                setIsLoading(false);
                const model = gltf.scene;

                model.traverse((o) => {
                    if (o.isMesh) {
                        o.castShadow = true;
                        o.receiveShadow = true;
                        if (o.morphTargetDictionary && (o.name.includes('Head') || o.name.includes('Wolf3D_Head'))) {
                            partsRef.current.morphTargetMesh = o;
                            const dict = o.morphTargetDictionary;
                            const indices = morphIndicesRef.current;
                            ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'mouthOpen'].forEach(k => {
                                if (dict[k] !== undefined) indices.speech.push(dict[k]);
                            });
                            ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'].forEach(k => {
                                if (dict[k] !== undefined) indices.subtle.push(dict[k]);
                            });
                            if (dict['eyesClosed'] !== undefined) indices.blink = dict['eyesClosed'];
                            ['eyeSquintLeft', 'eyeSquintRight'].forEach(k => {
                                if (dict[k] !== undefined) indices.squint.push(dict[k]);
                            });
                        }
                    }
                    if (o.isBone) {
                        if (o.name === 'RightArm') partsRef.current.rightArm = o;
                        if (o.name === 'LeftArm') partsRef.current.leftArm = o;
                        if (o.name === 'RightForeArm') partsRef.current.rightForeArm = o;
                        if (o.name === 'LeftForeArm') partsRef.current.leftForeArm = o;
                        if (o.name === 'RightEye') partsRef.current.rightEyeBone = o;
                        if (o.name === 'LeftEye') partsRef.current.leftEyeBone = o;
                    }
                });

                const box = new THREE.Box3().setFromObject(model);
                model.position.y = -box.min.y;
                const group = new THREE.Group();
                group.add(model);
                scene.add(group);
                avatarGroupRef.current = group;

                startBlinking();
                startGazeShift();
            });

            window.addEventListener('resize', handleResize);
        };

        const handleResize = () => {
            if (cameraRef.current && rendererRef.current && containerRef.current) {
                const width = containerRef.current.clientWidth;
                const height = containerRef.current.clientHeight;
                cameraRef.current.aspect = width / height;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(width, height);
            }
        };

        const startBlinking = () => {
            const blinkLoop = () => {
                if (!isMountedRef.current) return;
                const { morphTargetMesh } = partsRef.current;
                const { blink } = morphIndicesRef.current;
                if (morphTargetMesh && blink !== null) {
                    morphTargetMesh.morphTargetInfluences[blink] = 1;
                    setTimeout(() => {
                        if (!isMountedRef.current) return;
                        morphTargetMesh.morphTargetInfluences[blink] = 0;
                        setTimeout(blinkLoop, Math.random() * 3000 + 2000);
                    }, 150);
                } else {
                    setTimeout(blinkLoop, 1000);
                }
            };
            blinkLoop();
        };

        const startGazeShift = () => {
            const shiftLoop = () => {
                if (!isMountedRef.current) return;
                const { rightEyeBone, leftEyeBone } = partsRef.current;
                if (rightEyeBone && leftEyeBone) {
                    const x = (Math.random() - 0.5) * 0.1; 
                    const y = (Math.random() - 0.5) * 0.1;
                    rightEyeBone.rotation.x = x; rightEyeBone.rotation.y = y;
                    leftEyeBone.rotation.x = x; leftEyeBone.rotation.y = y;
                }
                setTimeout(shiftLoop, Math.random() * 1500 + 500);
            };
            shiftLoop();
        };

        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                const time = clockRef.current.getElapsedTime();
                const { rightArm, leftArm, rightForeArm, leftForeArm } = partsRef.current;
                
                if (avatarGroupRef.current) avatarGroupRef.current.position.y = Math.sin(time * 1.5) * 0.002;
                if (rightArm && leftArm) {
                    const breathSway = Math.sin(time * 1.5) * 0.01; 
                    rightArm.rotation.z = POSE.sZ + breathSway; rightArm.rotation.y = POSE.sY; rightArm.rotation.x = POSE.sX;
                    leftArm.rotation.z = -POSE.sZ - breathSway; leftArm.rotation.y = -POSE.sY; leftArm.rotation.x = POSE.sX;
                }
                if (rightForeArm && leftForeArm) {
                    rightForeArm.rotation.x = POSE.eX; rightForeArm.rotation.y = POSE.eY; rightForeArm.rotation.z = 0;
                    leftForeArm.rotation.x = POSE.eX; leftForeArm.rotation.y = -POSE.eY; leftForeArm.rotation.z = 0;
                }
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };

        init();
        animate();

        return () => {
            isMountedRef.current = false;
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(requestRef.current);
            if (rendererRef.current && containerRef.current) {
                if (rendererRef.current.domElement && rendererRef.current.domElement.parentNode === containerRef.current) {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                }
                rendererRef.current.dispose();
            }
            stopSpeaking();
        };
    }, []);

    // ★ 4. 強制停止說話 (閉嘴技術)
    const stopSpeaking = () => {
        window.speechSynthesis.cancel();
        
        if (timersRef.current.mouth) clearInterval(timersRef.current.mouth);
        if (timersRef.current.expression) clearInterval(timersRef.current.expression);
        
        const { morphTargetMesh } = partsRef.current;
        const indices = morphIndicesRef.current;
        if (morphTargetMesh) {
            [...indices.speech, ...indices.subtle, ...indices.squint].forEach(idx => {
                if(morphTargetMesh.morphTargetInfluences[idx] !== undefined) {
                    morphTargetMesh.morphTargetInfluences[idx] = 0;
                }
            });
            if (indices.blink) morphTargetMesh.morphTargetInfluences[indices.blink] = 0;
        }
    };
    
    useImperativeHandle(ref, () => ({
        speak: (textToSpeak) => {
            handleSpeak(textToSpeak);
        }
    }));

    const handleSpeak = (textToSpeak) => {
        // 先停再說，防止重疊
        if (!textToSpeak) return;
        stopSpeaking();

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        
        // ★ 5. 使用「選單」選到的聲音
        if (voiceList.length > 0) {
            utterance.voice = voiceList[selectedVoiceIndex];
        }
        
        utterance.pitch = 1.1; // 稍微亮一點
        utterance.rate = 1.05;

        const { morphTargetMesh } = partsRef.current;
        const indices = morphIndicesRef.current;

        utterance.onstart = () => {
            // 嘴型計時器
            timersRef.current.mouth = setInterval(() => {
                if (!morphTargetMesh || indices.speech.length === 0) return;
                indices.speech.forEach(idx => morphTargetMesh.morphTargetInfluences[idx] = 0);
                const mainIdx = indices.speech[Math.floor(Math.random() * indices.speech.length)];
                morphTargetMesh.morphTargetInfluences[mainIdx] = Math.random() * 0.5 + 0.2;
                if (Math.random() > 0.5) {
                    const secondIdx = indices.speech[Math.floor(Math.random() * indices.speech.length)];
                    morphTargetMesh.morphTargetInfluences[secondIdx] += Math.random() * 0.3;
                }
            }, 80);

            // 表情計時器
            timersRef.current.expression = setInterval(() => {
                if (!morphTargetMesh) return;
                if (indices.subtle.length > 0 && Math.random() > 0.6) {
                    indices.subtle.forEach(idx => morphTargetMesh.morphTargetInfluences[idx] = 0);
                    const idx = indices.subtle[Math.floor(Math.random() * indices.subtle.length)];
                    morphTargetMesh.morphTargetInfluences[idx] = Math.random() * 0.4 + 0.1;
                    setTimeout(() => { if(morphTargetMesh) morphTargetMesh.morphTargetInfluences[idx] = 0 }, 300);
                }
                if (indices.squint.length > 0 && Math.random() > 0.7) {
                    const intensity = Math.random() * 0.4 + 0.1;
                    indices.squint.forEach(idx => morphTargetMesh.morphTargetInfluences[idx] = intensity);
                    setTimeout(() => { if(morphTargetMesh) indices.squint.forEach(idx => morphTargetMesh.morphTargetInfluences[idx] = 0); }, 500);
                }
            }, 400);
        };

        // 結束時確實閉嘴
        utterance.onend = () => {
            stopSpeaking();
        };

        window.speechSynthesis.speak(utterance);
    };

    return (
        <div style={styles.body}>
            {isLoading && <div style={styles.loading}>正在喚醒 AI 模型...</div>}
            <div ref={containerRef} style={styles.avatarContainer} />
            {/* <div style={styles.controls}> */}
                
                {/* 聲音選單 */}
                {/* <select 
                    style={styles.select}
                    value={selectedVoiceIndex}
                    onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
                >
                    {voiceList.length === 0 && <option>正在載入聲音...</option>}
                    {voiceList.map((voice, index) => (
                        <option key={voice.name} value={index}>
                            {voice.name} ({voice.lang})
                        </option>
                    ))}
                </select> */}

                {/* <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    style={styles.input}
                /> */}
                {/* <button 
                    onClick={handleSpeak}
                    style={styles.button}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#0056b3'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#007bff'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                    說話
                </button>
            </div> */}
        </div>
    );
});

const styles = {
    body: { position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(circle at center, #3a3a3a 0%, #1a1a1a 100%)', overflow: 'hidden', fontFamily: '"Microsoft JhengHei", sans-serif', color: 'white' },
    avatarContainer: { width: '100%', height: '100%' },
    loading: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#aaa', fontSize: '18px', pointerEvents: 'none', zIndex: 10 },
    // controls: { position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', zIndex: 100, background: 'rgba(0,0,0,0.6)', padding: '15px 25px', borderRadius: '50px', backdropFilter: 'blur(5px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
    input: { padding: '12px 20px', width: '300px', borderRadius: '30px', border: '1px solid #555', fontSize: '16px', outline: 'none', background: 'rgba(255,255,255,0.1)', color: 'white' },
    select: { padding: '12px 20px', borderRadius: '30px', border: '1px solid #555', fontSize: '14px', outline: 'none', background: '#333', color: 'white', cursor: 'pointer', maxWidth: '150px' },
    button: { padding: '12px 30px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', transition: '0.3s', boxShadow: '0 5px 15px rgba(0,123,255,0.4)' }
};

export default AvatarViewer;
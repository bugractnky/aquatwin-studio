import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  STATIONS,
  PARAMS,
  inside,
  bottomAt,
  predict,
  dataColor,
  vesselPosition,
} from "./model.js";
const Z = 5;
export default function Twin({
  mission,
  records,
  baseline,
  param,
  depth,
  selectedStation,
  selectedRecord,
  onSelectStation,
  onSelectRecord,
  view,
  mode,
  layer,
  theme,
  reducedMotion,
  cameraCommand,
}) {
  const host = useRef(),
    labels = useRef(),
    north = useRef(),
    engine = useRef(),
    latest = useRef(),
    [error, setError] = useState(""),
    [hover, setHover] = useState(null);
  latest.current = {
    mission,
    records,
    baseline,
    param,
    depth,
    selectedStation,
    selectedRecord,
    onSelectStation,
    onSelectRecord,
    view,
    mode,
    layer,
    theme,
    reducedMotion,
  };
  useEffect(() => {
    const el = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(
        "WebGL kullanılamıyor. Üstteki istasyon seçicisi, profil ve ölçüm tablosu aynı verilere erişim sağlar.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    camera.position.set(64, 60, 78);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -6, 0);
    controls.enableDamping = true;
    controls.minDistance = 28;
    controls.maxDistance = 150;
    controls.maxPolarAngle = Math.PI * 0.48;
    scene.add(new THREE.AmbientLight(0xffffff, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(20, 60, 30);
    scene.add(sun);
    const grid = new THREE.GridHelper(120, 24, 0x78909c, 0xced8de);
    grid.position.y = -25;
    scene.add(grid);
    const bottomVertices = [],
      bottomColors = [];
    for (let x = -42; x < 42; x += 3)
      for (let z = -24; z < 24; z += 3) {
        const corners = [
          [x, z],
          [x + 3, z],
          [x + 3, z + 3],
          [x, z + 3],
        ];
        if (!corners.every(([a, b]) => inside(a, b))) continue;
        for (const index of [0, 1, 2, 0, 2, 3]) {
          const [a, b] = corners[index];
          bottomVertices.push(a, -bottomAt(a, b) * Z, b);
          const c = new THREE.Color("#8da5a7");
          bottomColors.push(c.r, c.g, c.b);
        }
      }
    const bottomGeo = new THREE.BufferGeometry();
    bottomGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(bottomVertices, 3),
    );
    bottomGeo.computeVertexNormals();
    const bottom = new THREE.Mesh(
      bottomGeo,
      new THREE.MeshStandardMaterial({
        color: "#a8b8b8",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
        wireframe: true,
      }),
    );
    scene.add(bottom);
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, 43, 25, 0, Math.PI * 2, false, 0);
    const surfaceGeo = new THREE.ShapeGeometry(shape, 80);
    surfaceGeo.rotateX(Math.PI / 2);
    const surface = new THREE.Mesh(
      surfaceGeo,
      new THREE.MeshBasicMaterial({
        color: "#5295a8",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      }),
    );
    scene.add(surface);
    const rim = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 100 }, (_, i) => {
          const a = (i / 100) * Math.PI * 2;
          return new THREE.Vector3(43 * Math.cos(a), 0, 25 * Math.sin(a));
        }),
      ),
      new THREE.LineBasicMaterial({ color: 0x478290 }),
    );
    scene.add(rim);
    const route = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        STATIONS.map((s) => new THREE.Vector3(s.x, 0.15, s.z)),
      ),
      new THREE.LineDashedMaterial({
        color: 0x738d98,
        dashSize: 1,
        gapSize: 1,
        transparent: true,
        opacity: 0.7,
      }),
    );
    route.computeLineDistances();
    scene.add(route);
    const boat = new THREE.Group();
    for (const x of [-1.2, 1.2]) {
      const h = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.7, 4.4),
        new THREE.MeshStandardMaterial({ color: 0xf4f7f9 }),
      );
      h.position.set(x, 0.6, 0);
      boat.add(h);
    }
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.5, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x136a7c }),
    );
    deck.position.y = 1;
    boat.add(deck);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.3),
      new THREE.MeshStandardMaterial({ color: 0x344c5b }),
    );
    mast.position.set(0, 2, -0.5);
    boat.add(mast);
    scene.add(boat);
    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 1.4, 14),
      new THREE.MeshStandardMaterial({
        color: 0xf2b85c,
        metalness: 0.2,
        roughness: 0.5,
      }),
    );
    scene.add(pod);
    const cable = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(0, -1, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0x546d78 }),
    );
    scene.add(cable);
    const stationMeshes = STATIONS.map((s) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(1.2, 0.12, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0x2d727e }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(s.x, 0.2, s.z);
      m.userData = { station: s.id };
      scene.add(m);
      return m;
    });
    const vertical = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
      new THREE.LineDashedMaterial({
        color: 0xb57818,
        dashSize: 0.6,
        gapSize: 0.5,
      }),
    );
    scene.add(vertical);
    const sampleGroup = new THREE.Group(),
      fieldGroup = new THREE.Group();
    scene.add(sampleGroup, fieldGroup);
    const raycaster = new THREE.Raycaster(),
      mouse = new THREE.Vector2();
    let down = null;
    const hitAt = (e) => {
      const r = el.getBoundingClientRect();
      mouse.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      return raycaster.intersectObjects([
        ...sampleGroup.children,
        ...stationMeshes,
      ])[0];
    };
    const pointerdown = (e) => {
      down = [e.clientX, e.clientY];
    };
    const click = (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5)
        return;
      const h = hitAt(e);
      if (h) {
        if (h.object.userData.record)
          latest.current.onSelectRecord(h.object.userData.record);
        else latest.current.onSelectStation(h.object.userData.station);
      }
    };
    const move = (e) => {
      const h = hitAt(e);
      if (!h) {
        setHover(null);
        return;
      }
      const r = h.object.userData.record;
      setHover(
        r
          ? {
              title: `${r.station} · ${r.depth.toFixed(1)} m`,
              text: `${r[latest.current.param].toFixed(PARAMS[latest.current.param].digits)} ${PARAMS[latest.current.param].unit} · ${r.quality === "ok" ? "Geçerli" : "Kararsız"}`,
            }
          : {
              title: h.object.userData.station,
              text: "İstasyon profilini seç",
            },
      );
    };
    const leave = () => setHover(null);
    const contextLost = (e) => {
      e.preventDefault();
      setError(
        "3D bağlamı kayboldu. Sayfayı yenileyin veya profil/tablo ile devam edin.",
      );
    };
    renderer.domElement.addEventListener("pointerdown", pointerdown);
    renderer.domElement.addEventListener("click", click);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerleave", leave);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    const resize = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    });
    resize.observe(el);
    let signature = "",
      lastView,
      lastTheme,
      raf;
    function clear(group) {
      while (group.children.length) {
        const o = group.children[0];
        group.remove(o);
        o.geometry?.dispose();
        o.material?.dispose();
      }
    }
    function animate(time) {
      const s = latest.current;
      if (lastTheme !== s.theme) {
        lastTheme = s.theme;
        grid.material.forEach?.((m) =>
          m.color.set(s.theme === "light" ? "#c8d5dc" : "#304553"),
        );
        if (!Array.isArray(grid.material))
          grid.material.color.set(s.theme === "light" ? "#c8d5dc" : "#304553");
        bottom.material.color.set(s.theme === "light" ? "#6f9297" : "#5b8a96");
        cable.material.color.set(s.theme === "light" ? "#2b5265" : "#c8e2e6");
      }
      if (lastView !== s.view) {
        lastView = s.view;
        camera.position.set(
          s.view === "2d" ? 0 : 64,
          s.view === "2d" ? 110 : 60,
          s.view === "2d" ? 0.01 : 78,
        );
        controls.target.set(0, s.view === "2d" ? 0 : -6, 0);
        controls.enableRotate = s.view !== "2d";
      }
      const v = vesselPosition(s.mission);
      boat.position.set(
        v.x,
        s.reducedMotion ? 0 : Math.sin(time * 0.0015) * 0.035,
        v.z,
      );
      if (s.mission.phase === "transit") {
        const next = STATIONS[Math.min(4, s.mission.stationIndex + 1)],
          st = STATIONS[s.mission.stationIndex];
        boat.rotation.y = Math.atan2(next.x - st.x, next.z - st.z);
      }
      pod.position.set(v.x, -s.mission.depth * Z - 0.5, v.z);
      pod.visible = s.view !== "2d" || s.mission.depth === 0;
      cable.geometry.setFromPoints([
        new THREE.Vector3(v.x, 1, v.z),
        new THREE.Vector3(v.x, -s.mission.depth * Z, v.z),
      ]);
      const selected =
        STATIONS.find((st) => st.id === s.selectedStation) || STATIONS[0];
      vertical.geometry.setFromPoints([
        new THREE.Vector3(selected.x, 0, selected.z),
        new THREE.Vector3(selected.x, -selected.bottom * Z, selected.z),
      ]);
      vertical.computeLineDistances();
      const sig = JSON.stringify([
        s.records.map((r) => r.id),
        s.param,
        s.depth,
        s.selectedStation,
        s.selectedRecord?.id,
        s.mode,
        s.layer,
        s.view,
      ]);
      if (signature !== sig) {
        signature = sig;
        clear(sampleGroup);
        clear(fieldGroup);
        stationMeshes.forEach((m) =>
          m.material.color.set(
            m.userData.station === s.selectedStation ? "#b26b12" : "#327e8c",
          ),
        );
        s.records.forEach((r) => {
          const chosen = s.selectedRecord?.id === r.id;
          const color =
            r.quality === "ok" ? dataColor(r[s.param], s.param) : "#b64a37";
          const mesh = new THREE.Mesh(
            r.quality === "ok"
              ? new THREE.SphereGeometry(
                  chosen
                    ? 0.85
                    : Math.abs(r.depth - s.depth) < 0.6
                      ? 0.65
                      : 0.48,
                  12,
                  10,
                )
              : new THREE.OctahedronGeometry(0.8),
            new THREE.MeshBasicMaterial({
              color,
              transparent: false,
              opacity: 1,
            }),
          );
          mesh.position.set(r.x, -r.depth * Z, r.z);
          mesh.userData = { record: r };
          sampleGroup.add(mesh);
          if (chosen) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(1.15, 0.1, 8, 32),
              new THREE.MeshBasicMaterial({ color: "#b4780f" }),
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(mesh.position);
            ring.userData = { record: r };
            sampleGroup.add(ring);
          }
        });
        if (
          s.layer !== "points" &&
          s.records.filter((r) => r.quality === "ok").length >= 4
        ) {
          const vertices = [],
            colors = [];
          const addQuad = (corners, pred) => {
            let color;
            if (s.mode === "delta") {
              const base = predict(s.baseline, s.param, pred.x, pred.z, pred.d);
              color = dataColor(pred.value, s.param, {
                mode: "delta",
                delta: base ? pred.value - base.value : 0,
              });
            } else
              color = dataColor(pred.value, s.param, {
                mode: s.mode,
                support: pred.support,
              });
            const c = new THREE.Color(color);
            for (const i of [0, 1, 2, 0, 2, 3]) {
              vertices.push(...corners[i]);
              colors.push(c.r, c.g, c.b);
            }
          };
          if (s.layer === "section") {
            for (let x = -42; x < 42; x += 2.5)
              for (let d = 0.1; d < 4.6; d += 0.2) {
                if (
                  bottomAt(x, selected.z) < d + 0.2 ||
                  bottomAt(x + 2.5, selected.z) < d + 0.2
                )
                  continue;
                const p = predict(s.records, s.param, x, selected.z, d);
                if (p)
                  addQuad(
                    [
                      [x, -d * Z, selected.z],
                      [x + 2.5, -d * Z, selected.z],
                      [x + 2.5, -(d + 0.2) * Z, selected.z],
                      [x, -(d + 0.2) * Z, selected.z],
                    ],
                    { ...p, x, z: selected.z, d },
                  );
              }
          } else
            for (let x = -42; x < 42; x += 2)
              for (let z = -24; z < 24; z += 2) {
                if (
                  ![
                    [x, z],
                    [x + 2, z],
                    [x + 2, z + 2],
                    [x, z + 2],
                  ].every(([a, b]) => bottomAt(a, b) >= s.depth)
                )
                  continue;
                const p = predict(s.records, s.param, x + 1, z + 1, s.depth);
                if (p)
                  addQuad(
                    [
                      [x, -s.depth * Z, z],
                      [x + 2, -s.depth * Z, z],
                      [x + 2, -s.depth * Z, z + 2],
                      [x, -s.depth * Z, z + 2],
                    ],
                    { ...p, x: x + 1, z: z + 1, d: s.depth },
                  );
              }
          const g = new THREE.BufferGeometry();
          g.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3),
          );
          g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
          const m = new THREE.Mesh(
            g,
            new THREE.MeshBasicMaterial({
              vertexColors: true,
              side: THREE.DoubleSide,
              transparent: false,
              opacity: 1,
              depthWrite: true,
            }),
          );
          fieldGroup.add(m);
        }
      }
      controls.update();
      renderer.render(scene, camera);
      const width = el.clientWidth,
        height = el.clientHeight;
      if (labels.current) {
        const nodes = labels.current.children;
        STATIONS.forEach((st, i) => {
          const p = new THREE.Vector3(st.x, 1.6, st.z).project(camera),
            node = nodes[i];
          if (node) {
            node.style.transform = `translate(${(p.x * 0.5 + 0.5) * width}px,${(-p.y * 0.5 + 0.5) * height}px) translate(-50%,-100%)`;
            node.style.visibility = p.z > 1 ? "hidden" : "visible";
          }
        });
        for (let d = 0; d <= 4; d++) {
          const p = new THREE.Vector3(selected.x, -d * Z, selected.z).project(
              camera,
            ),
            node = nodes[5 + d];
          if (node) {
            node.style.transform = `translate(${(p.x * 0.5 + 0.5) * width + 12}px,${(-p.y * 0.5 + 0.5) * height}px)`;
            node.style.display =
              s.view === "2d" || d > selected.bottom ? "none" : "block";
          }
        }
      }
      if (north.current) {
        const a = controls.target.clone().project(camera),
          b = controls.target
            .clone()
            .add(new THREE.Vector3(0, 0, -10))
            .project(camera);
        const angle =
          (Math.atan2((b.x - a.x) * width, (b.y - a.y) * height) * 180) /
          Math.PI;
        north.current.style.transform = `rotate(${angle}deg)`;
      }
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    engine.current = { camera, controls };
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerdown);
      renderer.domElement.removeEventListener("click", click);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
      });
      renderer.dispose();
      el.replaceChildren();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    if (!engine.current || !cameraCommand) return;
    const { camera, controls } = engine.current;
    const delta = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(delta);
    switch (cameraCommand.action) {
      case "left":
        sph.theta -= Math.PI / 10;
        break;
      case "right":
        sph.theta += Math.PI / 10;
        break;
      case "up":
        sph.phi = Math.max(0.12, sph.phi - 0.15);
        break;
      case "down":
        sph.phi = Math.min(Math.PI * 0.48, sph.phi + 0.15);
        break;
      case "in":
        sph.radius = Math.max(28, sph.radius * 0.85);
        break;
      case "out":
        sph.radius = Math.min(150, sph.radius * 1.15);
        break;
      default:
        camera.position.set(
          view === "2d" ? 0 : 64,
          view === "2d" ? 110 : 60,
          view === "2d" ? 0.01 : 78,
        );
        controls.target.set(0, view === "2d" ? 0 : -6, 0);
        controls.update();
        return;
    }
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3().setFromSpherical(sph));
    controls.update();
  }, [cameraCommand]);
  return (
    <div className="scene-shell">
      <div
        className="webgl-host"
        ref={host}
        role="img"
        aria-label={`Şematik ${view === "2d" ? "üstten" : "3D"} gölet. Seçili istasyon ${selectedStation}, derinlik ${depth} metre. Eşdeğer veriler profil ve tabloda.`}
      />
      <div className="scene-labels" ref={labels} aria-hidden="true">
        {STATIONS.map((s) => (
          <span
            key={s.id}
            className={
              s.id === selectedStation
                ? "station-label picked"
                : "station-label"
            }
          >
            {s.id}
          </span>
        ))}
        {[0, 1, 2, 3, 4].map((d) => (
          <span className="depth-label" key={d}>
            {d} m
          </span>
        ))}
      </div>
      <div className="scene-compass" aria-hidden="true">
        <span ref={north}>↑</span>
        <strong>N</strong>
      </div>
      <div className="scene-note">
        Şematik batimetri · derinlik 5× abartılı
        <br />
        Yerel metre koordinatları · gerçek gölet haritası değil
      </div>
      {hover && (
        <div className="scene-tooltip">
          <strong>{hover.title}</strong>
          <span>{hover.text}</span>
        </div>
      )}
      {error && (
        <div className="scene-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

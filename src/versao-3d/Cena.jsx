import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, MapControls, OrthographicCamera, RoundedBox } from '@react-three/drei'
import { CAFE, CORES, LUGARES } from './planta.js'

const VELOCIDADE = 3.4
const COR_ESTADO = { trabalhando: '#22c55e', disponivel: '#3b82f6', parado: '#cbd5e1' }
const ROTULO_ORIGEM = { aovivo: 'ao vivo', reprise: 'reprise', ambiente: 'ambiente' }

function hora(ts) {
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Mesa({ lugar, estado, selecionada, onClick }) {
  const [x, z] = lugar.mesa
  const ligado = estado !== 'parado'
  const brilho = estado === 'trabalhando' ? 1.3 : 0.45
  const tela = useRef()
  useFrame(({ clock }) => {
    if (tela.current && estado === 'trabalhando') {
      tela.current.emissiveIntensity = 1.1 + Math.sin(clock.elapsedTime * 6 + x) * 0.25
    }
  })
  return (
    <group position={[x, 0, z]} onClick={onClick}>
      <RoundedBox args={[2.5, 0.12, 1.2]} radius={0.05} position={[0, 0.82, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={selecionada ? '#dbe6ff' : '#ffffff'} />
      </RoundedBox>
      {[[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.4, pz]} castShadow>
          <boxGeometry args={[0.08, 0.8, 0.08]} />
          <meshStandardMaterial color="#c3cde0" />
        </mesh>
      ))}
      {/* monitor: a tela fica virada para quem senta */}
      <group position={[0, 0.88, 0]} rotation={[0, lugar.lado === -1 ? Math.PI : 0, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.1, 0.2, 0.1]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <RoundedBox args={[1.15, 0.7, 0.07]} radius={0.03} position={[0, 0.55, 0]} castShadow>
          <meshStandardMaterial color="#1e293b" />
        </RoundedBox>
        <mesh position={[0, 0.55, 0.04]}>
          <planeGeometry args={[1.03, 0.58]} />
          <meshStandardMaterial
            ref={tela}
            color={ligado ? '#bfdbfe' : '#0f172a'}
            emissive={ligado ? '#60a5fa' : '#000000'}
            emissiveIntensity={ligado ? brilho : 0}
          />
        </mesh>
      </group>
      {/* luz de estado, visível de qualquer ângulo */}
      <mesh position={[1.05, 0.98, 0.4]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color={COR_ESTADO[estado]} emissive={COR_ESTADO[estado]} emissiveIntensity={ligado ? 1.2 : 0} />
      </mesh>
      {/* cadeira */}
      <group position={[0, 0, lugar.lado * 1.15]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.1, 20]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <RoundedBox args={[0.66, 0.6, 0.08]} radius={0.03} position={[0, 0.82, lugar.lado * 0.36]} castShadow>
          <meshStandardMaterial color="#64748b" />
        </RoundedBox>
      </group>
    </group>
  )
}

function Balao({ cmd, para }) {
  return (
    <Html position={[0, 2.45, 0]} center zIndexRange={[40, 10]} style={{ pointerEvents: 'none' }}>
      <div className={`balao balao-${cmd.origem}`}>
        <div className="balao-topo">
          <span className="balao-origem">{ROTULO_ORIGEM[cmd.origem]}</span>
          {cmd.hora ? <span>{hora(cmd.hora)}</span> : null}
          {para ? <span>para {para}</span> : null}
        </div>
        <div className="balao-texto">{cmd.texto}</div>
      </div>
    </Html>
  )
}

function Personagem({ id, nome, estado, cmd, nomes, selecionado, onClick, onFim }) {
  const lugar = LUGARES[id]
  const grupo = useRef()
  const corpo = useRef()
  const fase = useRef('sentado')
  const caminho = useRef([])
  const relogio = useRef(0)
  const atual = useRef(null)
  const [balao, setBalao] = useState(null)
  const cor = CORES[id] || '#64748b'
  const alturaSentado = id === 'voce' ? 0 : -0.18

  useEffect(() => {
    if (!cmd) return
    atual.current = cmd
    if (cmd.caminho?.length) {
      caminho.current = cmd.caminho.map((p) => [...p])
      fase.current = 'indo'
    } else {
      relogio.current = cmd.duracao
      fase.current = 'falando'
      setBalao(cmd)
    }
  }, [cmd?.id])

  useFrame(({ clock }, dt) => {
    const g = grupo.current
    if (!g) return
    const t = clock.elapsedTime
    if (fase.current === 'indo' || fase.current === 'voltando') {
      const alvo = caminho.current[0]
      if (!alvo) return
      const dx = alvo[0] - g.position.x
      const dz = alvo[1] - g.position.z
      const dist = Math.hypot(dx, dz)
      const passo = VELOCIDADE * Math.min(dt, 0.05)
      g.position.y = Math.abs(Math.sin(t * 11)) * 0.08
      if (dist > 0.01) g.rotation.y = Math.atan2(dx, dz)
      if (dist <= passo) {
        g.position.x = alvo[0]
        g.position.z = alvo[1]
        caminho.current.shift()
        if (!caminho.current.length) {
          const c = atual.current
          if (fase.current === 'indo') {
            fase.current = 'falando'
            relogio.current = c.duracao
            if (c.olhar) g.rotation.y = Math.atan2(c.olhar[0] - g.position.x, c.olhar[1] - g.position.z)
            g.position.y = 0
            setBalao(c)
          } else {
            fase.current = 'sentado'
            g.rotation.y = lugar.giro
            onFim(c.id)
          }
        }
      } else {
        g.position.x += (dx / dist) * passo
        g.position.z += (dz / dist) * passo
      }
      return
    }
    if (fase.current === 'falando') {
      relogio.current -= dt
      if (corpo.current) corpo.current.position.y = 0.62 + Math.sin(t * 5) * 0.02
      if (relogio.current <= 0) {
        const c = atual.current
        setBalao(null)
        if (c.caminho?.length) {
          const volta = c.caminho.slice(0, -1).reverse()
          caminho.current = [...volta.map((p) => [...p]), [...lugar.assento]]
          fase.current = 'voltando'
        } else {
          fase.current = 'sentado'
          onFim(c.id)
        }
      }
      return
    }
    // sentado: quem está trabalhando balança de leve, como quem digita
    g.position.y = alturaSentado
    if (corpo.current) {
      corpo.current.position.y = 0.62 + (estado === 'trabalhando' ? Math.sin(t * 9 + lugar.assento[0]) * 0.025 : 0)
    }
  })

  return (
    <group
      ref={grupo}
      position={[lugar.assento[0], alturaSentado, lugar.assento[1]]}
      rotation={[0, lugar.giro, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
    >
      {selecionado ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22, 0]}>
          <ringGeometry args={[0.55, 0.68, 40]} />
          <meshBasicMaterial color="#2f5bea" />
        </mesh>
      ) : null}
      <group ref={corpo} position={[0, 0.62, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.3, 0.5, 6, 16]} />
          <meshStandardMaterial color={cor} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.74, 0]} castShadow>
          <sphereGeometry args={[0.29, 24, 24]} />
          <meshStandardMaterial color="#f4d7bd" roughness={0.7} />
        </mesh>
        {[-0.1, 0.1].map((ox) => (
          <mesh key={ox} position={[ox, 0.78, 0.26]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshBasicMaterial color="#1e293b" />
          </mesh>
        ))}
        <mesh position={[0, 0.96, -0.03]}>
          <sphereGeometry args={[0.3, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
          <meshStandardMaterial color={cor} roughness={0.8} />
        </mesh>
      </group>
      <Html position={[0, 1.95, 0]} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`cracha ${selecionado ? 'cracha-sel' : ''}`}>
          <i style={{ background: COR_ESTADO[estado] || '#111827' }} />
          {nome}
        </div>
      </Html>
      {balao ? <Balao cmd={balao} para={balao.para ? nomes[balao.para] : null} /> : null}
    </group>
  )
}

function Planta({ pos, escala = 1 }) {
  return (
    <group position={pos} scale={escala}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.25, 0.6, 16]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial color="#4ade80" roughness={0.9} />
      </mesh>
      <mesh position={[0.25, 1.5, 0.1]} castShadow>
        <sphereGeometry args={[0.36, 16, 16]} />
        <meshStandardMaterial color="#22c55e" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Sala() {
  const faixas = useMemo(() => [-10, -5, 0, 5, 10], [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0, 0]} receiveShadow>
        <planeGeometry args={[29, 15]} />
        <meshStandardMaterial color="#f4f7fd" />
      </mesh>
      {/* tapete do corredor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[25, 2.3]} />
        <meshStandardMaterial color="#dfe8fb" />
      </mesh>
      {faixas.map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, 0]}>
          <planeGeometry args={[1.6, 0.08]} />
          <meshBasicMaterial color="#b6c7f3" />
        </mesh>
      ))}
      {/* paredes do fundo e da esquerda */}
      <mesh position={[0.5, 1.3, -7.6]} receiveShadow>
        <boxGeometry args={[29.2, 2.6, 0.2]} />
        <meshStandardMaterial color="#e3eafa" />
      </mesh>
      <mesh position={[-14.1, 1.3, 0]} receiveShadow>
        <boxGeometry args={[0.2, 2.6, 15.2]} />
        <meshStandardMaterial color="#dbe4f8" />
      </mesh>
      {[-9, -3, 3, 9].map((x) => (
        <mesh key={x} position={[x, 1.55, -7.48]}>
          <boxGeometry args={[3.4, 1.3, 0.06]} />
          <meshStandardMaterial color="#bcd6ff" emissive="#93c5fd" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {/* porta de entrada */}
      <mesh position={[-13.98, 1.1, 0]}>
        <boxGeometry args={[0.06, 2.2, 1.8]} />
        <meshStandardMaterial color="#2f5bea" />
      </mesh>
      {/* cantinho do café */}
      <group position={[CAFE.balcao[0], 0, CAFE.balcao[1]]}>
        <RoundedBox args={[2.2, 0.95, 0.9]} radius={0.05} position={[0, 0.48, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#ffffff" />
        </RoundedBox>
        <RoundedBox args={[0.55, 0.7, 0.5]} radius={0.05} position={[-0.5, 1.3, 0]} castShadow>
          <meshStandardMaterial color="#1e293b" />
        </RoundedBox>
        <mesh position={[0.35, 1.03, 0.1]}>
          <cylinderGeometry args={[0.09, 0.07, 0.16, 12]} />
          <meshStandardMaterial color="#2f5bea" />
        </mesh>
        <mesh position={[0.65, 1.03, -0.1]}>
          <cylinderGeometry args={[0.09, 0.07, 0.16, 12]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      </group>
      <Planta pos={[-12.8, 0, -6.4]} escala={1.2} />
      <Planta pos={[13.8, 0, 6.2]} />
      <Planta pos={[-12.8, 0, 6.2]} />
    </group>
  )
}

export default function Cena({ agentes, cmds, selecionado, onSelecionar, onFim }) {
  const nomes = useMemo(() => {
    const n = { voce: 'Você' }
    agentes.forEach((a) => (n[a.id] = a.nome))
    return n
  }, [agentes])
  return (
    <Canvas flat shadows dpr={[1, 2]} onPointerMissed={() => onSelecionar(null)}>
      <color attach="background" args={['#e6ecf8']} />
      <OrthographicCamera makeDefault position={[19, 20, 23]} zoom={36} near={-80} far={200} />
      <MapControls
        makeDefault
        enableDamping
        minZoom={24}
        maxZoom={110}
        maxPolarAngle={Math.PI / 2.6}
        minPolarAngle={Math.PI / 6}
        target={[-1.5, 0, -2.5]}
      />
      <ambientLight intensity={1.25} />
      <hemisphereLight args={['#ffffff', '#dfe7fa', 0.9]} />
      <directionalLight
        position={[10, 22, 12]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />
      <Sala />
      {agentes.map((a) => (
        <Mesa
          key={a.id}
          lugar={LUGARES[a.id]}
          estado={a.estado}
          selecionada={selecionado === a.id}
          onClick={(e) => {
            e.stopPropagation()
            onSelecionar(a.id)
          }}
        />
      ))}
      {agentes.map((a) => (
        <Personagem
          key={a.id}
          id={a.id}
          nome={a.nome}
          estado={a.estado}
          cmd={cmds[a.id]}
          nomes={nomes}
          selecionado={selecionado === a.id}
          onClick={() => onSelecionar(a.id)}
          onFim={onFim}
        />
      ))}
      <Personagem id="voce" nome="Você" estado="voce" cmd={cmds.voce} nomes={nomes} onFim={onFim} />
    </Canvas>
  )
}

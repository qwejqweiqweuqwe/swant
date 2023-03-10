let vertexShader = "\nvoid main() {\n    gl_Position = vec4( position, 1.0 );\n}\n",
	fragmentShader = '\nuniform vec2 u_resolution;\n  uniform float u_pxaspect;\n  uniform vec2 u_mouse;\n  uniform float u_time;\n  uniform sampler2D u_noise;\n  uniform sampler2D u_text500;\n  uniform bool u_mousemoved;\n  uniform vec3 lightcolour;\n  uniform vec3 falloffcolour;\n  uniform vec3 bgcolour;\n  uniform bool addNoise;\n  uniform float lightStrength;\n  \n  #define PI 3.141592653589793\n  #define TAU 6.283185307179586\n\n  const float decay = .96; // the amount to decay each sample by\n  const float exposure = .35; // the screen exposure\n  const float falloff = .5;\n  const int samples = 12; // The number of samples to take\n  const float density = .98; // The density of the "smoke"\n  const float weight = .25; // how heavily to apply each step of the supersample\n  const int octaves = 1; // the number of octaves to generate in the FBM noise\n  const float seed = 43758.5453123; // A random seed :)\n  \n  vec2 res = u_resolution / u_pxaspect;\n  \n  float starSDF(vec2 st, int V, float s) {\n      float a = atan(st.y, st.x)/TAU;\n      float seg = a * float(V);\n      a = ((floor(seg) + 0.5)/float(V) + \n          mix(s,-s,step(.5,fract(seg)))) \n          * TAU;\n      return abs(dot(vec2(cos(a),sin(a)),\n                     st));\n  }\n  \n  float random2d(vec2 uv) {\n    uv /= 256.;\n    vec4 tex = texture2D(u_noise, uv);\n    return mix(tex.x, tex.y, tex.a);\n  }\n  vec2 random2(vec2 st, float seed){\n      st = vec2( dot(st,vec2(127.1,311.7)),\n                dot(st,vec2(269.5,183.3)) );\n      return -1.0 + 2.0*fract(sin(st)*seed);\n  }\n\n  float noise(vec2 st, float seed) {\n    vec3 x = vec3(st, 1.);\n    vec3 p = floor(x);\n    vec3 f = fract(x);\n    f = f*f*(3.0-2.0*f);\n    vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;\n    vec2 rg = texture2D(u_noise, (uv+0.5) / 256., 0.).yx - .5;\n    return mix( rg.x, rg.y, f.z );\n  }\n  \n  float fbm1(in vec2 _st, float seed) {\n    float v = 0.0;\n    float a = 0.5;\n    vec2 shift = vec2(100.0);\n\n    mat2 rot = mat2(cos(0.5), sin(0.5),\n                    -sin(0.5), cos(0.50));\n    for (int i = 0; i < octaves; ++i) {\n        v += a * noise(_st, seed);\n        _st = rot * _st * 2.0 + shift;\n        a *= 0.4;\n    }\n    return v + .4;\n  }\n  \n  float pattern(vec2 uv, float seed, float time, inout vec2 q, inout vec2 r) {\n\n    q = vec2( fbm1( uv + vec2(0.0,0.0), seed ),\n                   fbm1( uv + vec2(5.2,1.3), seed ) );\n\n    r = vec2( fbm1( uv + 4.0*q + vec2(1.7 - time / 2.,9.2), seed ),\n                   fbm1( uv + 4.0*q + vec2(8.3 - time / 2.,2.8), seed ) );\n\n    float rtn = fbm1( uv + 4.0*r, seed );\n\n    return rtn;\n  }\n  \n  float tri(vec2 uv) {\n    uv = (uv * 2.-1.)*2.;\n    return max(abs(uv.x) * 0.866025 + uv.y * 0.5, -uv.y * 0.5);\n  }\n  float smin(float a, float b, float k) {\n      float res = exp(-k*a) + exp(-k*b);\n      return -log(res)/k;\n  }\n\n  float shapes(vec2 uv) {\n    \n    uv += u_mouse * .1;\n    \n    float aspect = res.x / res.y;\n    \n    float scale = 1. / aspect * .3;\n    \n    return texture2D(u_text500, (uv) * scale + .5, -1.).x;\n    \n  }\n  \n  float occlusion(vec2 uv, vec2 lightpos, float objects) {\n    return (1. - smoothstep(0.0, lightStrength, length(lightpos - uv))) * (1. - objects);\n  }\n  \n  vec4 mainRender(vec2 uv, inout vec4 fragcolour) {\n  \n    float scale = 4.;\n    uv *= scale;\n    \n    float exposure = exposure + (sin(u_time) * .5 + 1.) * .05;\n\n    vec2 _uv = uv;\n    vec2 lightpos = (vec2(u_mouse.x, u_mouse.y * -1.)) / u_resolution.y;\n    lightpos = u_mouse * scale;\n    \n    if(!u_mousemoved) {\n\n    }\n    \n    float obj = shapes(uv);\n    float map = occlusion(uv, lightpos, obj);\n\n    float _pattern = 0.;\n    vec2 q = vec2(0.);\n    vec2 r = vec2(0.);\n    if(addNoise) {\n      _pattern = pattern(_uv * 3. , seed, u_time, q, r) / 2.;\n    }\n\n    vec2 dtc = (_uv - lightpos) * (1. / float(samples) * density);\n\n    float illumination_decay = 1.;\n    vec3 basecolour = bgcolour;\n\n    for(int i=0; i<samples; i++) {\n      _uv -= dtc;\n      if(addNoise) {\n        uv += _pattern / 16.;\n      }\n      \n      float movement = u_time * 20. * float(i + 1);\n      \n      float dither = random2d(uv * 512. + mod(vec2(movement*sin(u_time * .5), -movement), 1000.)) * 2.;\n\n      float stepped_map = occlusion(uv, lightpos, shapes(_uv+dtc*dither));\n      stepped_map *= illumination_decay * weight;\n      illumination_decay *= decay;\n\n      map += stepped_map;\n    }\n\n    float l = length(lightpos - uv);\n\n    vec3 lightcolour = mix(lightcolour, falloffcolour, l*falloff);\n\n    vec3 colour = vec3(basecolour+map*exposure*lightcolour);\n    \n    fragcolour = vec4(colour,1.0);\n    return fragcolour;\n  }\n\nvoid main() {\n  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);\n  \n  mainRender(uv, gl_FragColor);\n}\n';

function removeProtocol(e) {
	return e.replace(/^https?\:\/\//i, "")
}
let domain = removeProtocol(window.location.origin);

function startBlyad(e) {
	let n, t, o, a, r, s, i;
	params = JSON.parse($("#rays").attr("data-params"));
	let l, u = new THREE.TextureLoader;

	function c(e) {
		s.setSize(window.innerWidth, window.innerHeight), i.u_resolution.value.x = s.domElement.width, i.u_resolution.value.y = s.domElement.height
	}

	function v(e) {
		requestAnimationFrame(v),
			function(e) {
				i.u_time.value = 5e-4 * e, l.material.uniforms.bgcolour.value = new THREE.Color(parseInt(params.bgColor, 16)), l.material.uniforms.lightcolour.value = new THREE.Color(parseInt(params.lightColor, 16)), l.material.uniforms.falloffcolour.value = new THREE.Color(parseInt(params.raysColor, 16)), l.material.uniforms.lightStrength.value = parseFloat(params.lightStrength), l.material.uniforms.u_text500.value = t, s.render(r, a)
			}(e)
	}
	u.setCrossOrigin("anonymous"), null != e && (params.texture = "https://res.cloudinary.com/swan4er/image/upload/v1660048644/wz2_kyouef.png"), u.load("https://static.tildacdn.com/tild6535-3834-4733-b031-393732316333/noise.png", e => {
		(n = e).wrapS = THREE.RepeatWrapping, n.wrapT = THREE.RepeatWrapping, n.minFilter = THREE.LinearFilter, u.load(params.texture, e => {
			t = e,
				function() {
					o = document.getElementById("rays"), (a = new THREE.Camera).position.z = 1, r = new THREE.Scene;
					var e = new THREE.PlaneBufferGeometry(2, 2);
					i = {
						u_time: {
							type: "f",
							value: 1
						},
						u_resolution: {
							type: "v2",
							value: new THREE.Vector2
						},
						u_pxaspect: {
							type: "f",
							value: window.devicePixelRatio
						},
						u_noise: {
							type: "t",
							value: n
						},
						u_text500: {
							type: "t",
							value: t
						},
						u_mouse: {
							type: "v2",
							value: new THREE.Vector2(-.1, -.1)
						},
						lightcolour: {
							type: "v3",
							value: new THREE.Color(14281983)
						},
						falloffcolour: {
							type: "v3",
							value: new THREE.Color(9765119)
						},
						bgcolour: {
							type: "v3",
							value: new THREE.Color(537180)
						},
						addNoise: {
							type: "b",
							value: !0
						},
						lightStrength: {
							type: "f",
							value: 3.5
						}
					};
					var u = new THREE.ShaderMaterial({
						uniforms: i,
						vertexShader: vertexShader,
						fragmentShader: fragmentShader
					});
					u.extensions.derivatives = !0, l = new THREE.Mesh(e, u), r.add(l), (s = new THREE.WebGLRenderer).setPixelRatio(window.devicePixelRatio), o.appendChild(s.domElement), c(), window.addEventListener("resize", c, !1), document.addEventListener("pointermove", e => {
						var n = $("#rays").offset();
						let t = $("#rays").height() / $("#rays").width(),
							o = e.pageX - n.left,
							a = e.pageY - n.top;
						i.u_mouse.value.x = (o - $("#rays").width() / 2) / $("#rays").width() / t, i.u_mouse.value.y = (a - $("#rays").height() / 2) / $("#rays").height() * -1, e.preventDefault()
					})
				}(), v()
		})
	})
}

$.getScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/88/three.min.js", function() {
	$.getScript("https://code.jquery.com/pep/0.4.3/pep.js", function() {
		startBlyad()
	})
});
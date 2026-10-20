# -*- coding: utf-8 -*-
"""Gera o catálogo de exercícios a partir da tabela compacta abaixo:

- src/core/data/catalog.ts, usado pelo app com os dados no aparelho;
- supabase/seed/0003_exercises_seed.sql, guardado para quando houver banco.

Formato de cada linha:
  slug | nome | padrão | equipamento | primários | secundários | descanso | passo | unilateral | dica
"""
import pathlib, re, unicodedata

MUSCLES = [
    ("peitoral", "Peitoral", "superior", 10),
    ("dorsal", "Dorsal", "superior", 20),
    ("trapezio", "Trapézio", "superior", 25),
    ("deltoide-anterior", "Deltoide anterior", "superior", 30),
    ("deltoide-lateral", "Deltoide lateral", "superior", 31),
    ("deltoide-posterior", "Deltoide posterior", "superior", 32),
    ("biceps", "Bíceps", "superior", 40),
    ("triceps", "Tríceps", "superior", 41),
    ("antebraco", "Antebraço", "superior", 42),
    ("quadriceps", "Quadríceps", "inferior", 50),
    ("posterior-de-coxa", "Posterior de coxa", "inferior", 51),
    ("gluteo", "Glúteo", "inferior", 52),
    ("gluteo-medio", "Glúteo médio", "inferior", 53),
    ("adutores", "Adutores", "inferior", 54),
    ("panturrilha", "Panturrilha", "inferior", 55),
    ("soleo", "Sóleo", "inferior", 56),
    ("abdomen", "Abdômen", "core", 60),
    ("obliquos", "Oblíquos", "core", 61),
    ("lombar", "Lombar", "core", 62),
]

RAW = """
# PEITO
supino-reto-barra|Supino reto com barra|empurrar_horizontal|barra|peitoral|triceps,deltoide-anterior|180|2.5|0|Escápulas retraídas e pés firmes no chão.
supino-reto-halteres|Supino reto com halteres|empurrar_horizontal|halter|peitoral|triceps,deltoide-anterior|180|2|0|Amplitude maior que a barra. Desça até sentir alongamento.
supino-inclinado-barra|Supino inclinado com barra|empurrar_horizontal|barra|peitoral|deltoide-anterior,triceps|180|2.5|0|Banco entre 30 e 45 graus.
supino-inclinado-halteres|Supino inclinado com halteres|empurrar_horizontal|halter|peitoral|deltoide-anterior,triceps|180|2|0|Banco a 30 graus. Não bata os halteres em cima.
supino-declinado-barra|Supino declinado com barra|empurrar_horizontal|barra|peitoral|triceps|150|2.5|0|
supino-maquina|Supino na máquina|empurrar_horizontal|maquina|peitoral|triceps,deltoide-anterior|120|5|0|Ajuste o banco para a pegada ficar na linha do mamilo.
supino-inclinado-maquina|Supino inclinado na máquina|empurrar_horizontal|maquina|peitoral|deltoide-anterior,triceps|120|5|0|
crucifixo-reto-halteres|Crucifixo reto com halteres|isolador|halter|peitoral||120|2|0|Cotovelo levemente flexionado e fixo. Carga leve.
crucifixo-inclinado-halteres|Crucifixo inclinado com halteres|isolador|halter|peitoral||120|2|0|O objetivo é alongamento sob tensão, não peso.
peck-deck|Peck deck|isolador|maquina|peitoral||90|5|0|Foco em alongar bem na abertura.
crossover-polia-alta|Crossover na polia alta|isolador|cabo|peitoral||90|2.5|0|Cruze as mãos no final do movimento.
crossover-polia-baixa|Crossover na polia baixa|isolador|cabo|peitoral|deltoide-anterior|90|2.5|0|
flexao-de-braco|Flexão de braço|empurrar_horizontal|peso_corporal|peitoral|triceps,abdomen|90|1|0|Corpo em prancha, sem afundar o quadril.
paralelas-peito|Paralelas com tronco inclinado|empurrar_horizontal|peso_corporal|peitoral|triceps|150|2.5|0|Incline o tronco à frente para levar carga ao peito.
pullover-halter|Pullover com halter|isolador|halter|peitoral|dorsal|120|2|0|
# OMBRO
desenvolvimento-barra|Desenvolvimento com barra|empurrar_vertical|barra|deltoide-anterior|triceps,deltoide-lateral|180|2.5|0|
desenvolvimento-halteres|Desenvolvimento com halteres|empurrar_vertical|halter|deltoide-anterior|triceps,deltoide-lateral|150|2|0|Sentado com encosto para proteger a lombar.
desenvolvimento-maquina|Desenvolvimento na máquina|empurrar_vertical|maquina|deltoide-anterior|triceps,deltoide-lateral|120|5|0|
desenvolvimento-arnold|Desenvolvimento Arnold|empurrar_vertical|halter|deltoide-anterior|deltoide-lateral,triceps|150|2|0|
elevacao-lateral-halteres|Elevação lateral com halteres|isolador|halter|deltoide-lateral||90|2|0|Peso leve. Sobe até a linha do ombro, desce controlado.
elevacao-lateral-cabo|Elevação lateral no cabo|isolador|cabo|deltoide-lateral||90|2.5|1|O cabo dá tensão melhor na parte de baixo.
elevacao-lateral-maquina|Elevação lateral na máquina|isolador|maquina|deltoide-lateral||90|5|0|
elevacao-frontal-halteres|Elevação frontal com halteres|isolador|halter|deltoide-anterior||90|2|0|
crucifixo-inverso-halteres|Crucifixo inverso com halteres|puxar_horizontal|halter|deltoide-posterior|trapezio|90|2|0|
crucifixo-inverso-maquina|Crucifixo inverso na máquina|puxar_horizontal|maquina|deltoide-posterior|trapezio|90|5|0|
face-pull|Face pull|puxar_horizontal|cabo|deltoide-posterior|trapezio|90|2.5|0|Puxe na altura do rosto, cotovelos altos.
encolhimento-halteres|Encolhimento com halteres|isolador|halter|trapezio||90|2|0|
encolhimento-barra|Encolhimento com barra|isolador|barra|trapezio||90|2.5|0|
remada-alta|Remada alta|puxar_vertical|barra|trapezio|deltoide-lateral,biceps|120|2.5|0|
# COSTAS
barra-fixa-pronada|Barra fixa pronada|puxar_vertical|peso_corporal|dorsal|biceps,trapezio|180|2.5|0|Braço totalmente estendido embaixo.
barra-fixa-supinada|Barra fixa supinada|puxar_vertical|peso_corporal|dorsal|biceps|180|2.5|0|
puxador-alto-aberto|Puxador alto pegada aberta|puxar_vertical|cabo|dorsal|biceps,trapezio|180|5|0|Peito estufado, barra na altura da clavícula.
puxador-alto-neutro|Puxador alto pegada neutra|puxar_vertical|cabo|dorsal|biceps|120|5|0|Triângulo ou barra paralela. Braço estendido em cima.
puxador-alto-supinado|Puxador alto pegada supinada|puxar_vertical|cabo|dorsal|biceps|120|5|0|
remada-curvada-barra|Remada curvada com barra|puxar_horizontal|barra|dorsal|trapezio,biceps,lombar|180|2.5|0|Tronco firme, coluna neutra.
remada-curvada-pronada|Remada curvada pegada pronada|puxar_horizontal|barra|dorsal|deltoide-posterior,trapezio|180|2.5|0|
remada-serrote|Remada serrote com halter|puxar_horizontal|halter|dorsal|biceps,trapezio|120|2|1|Um braço por vez, amplitude grande.
remada-baixa-cabo|Remada baixa no cabo|puxar_horizontal|cabo|dorsal|trapezio,biceps|150|5|0|Deixe o tronco ir um pouco à frente no alongamento.
remada-maquina|Remada na máquina|puxar_horizontal|maquina|dorsal|trapezio,biceps|120|5|0|Puxe com o cotovelo, solte a escápula no alongamento.
remada-cavalinho|Remada cavalinho|puxar_horizontal|barra|dorsal|trapezio,biceps|150|2.5|0|
remada-unilateral-maquina|Remada unilateral na máquina|puxar_horizontal|maquina|dorsal|biceps|120|5|1|
pulldown-braco-reto|Pulldown com braço estendido|isolador|cabo|dorsal||90|2.5|0|Cotovelo fixo. Isola o dorsal sem o bíceps.
levantamento-terra|Levantamento terra|dobradica_quadril|barra|lombar|gluteo,posterior-de-coxa,trapezio|240|5|0|Barra rente à canela. Coluna neutra do início ao fim.
# QUADRÍCEPS
agachamento-livre|Agachamento livre|agachamento|barra|quadriceps|gluteo,lombar,posterior-de-coxa|240|2.5|0|Desça até onde mantiver a coluna neutra.
agachamento-frontal|Agachamento frontal|agachamento|barra|quadriceps|gluteo,abdomen|180|2.5|0|
agachamento-smith|Agachamento no Smith|agachamento|maquina|quadriceps|gluteo|180|5|0|
hack-machine|Hack machine|agachamento|maquina|quadriceps|gluteo|180|5|0|Profundidade moderada se o joelho incomodar.
leg-press|Leg press|agachamento|maquina|quadriceps|gluteo,posterior-de-coxa|180|5|0|Pés na largura dos ombros. Não desça além do conforto do joelho.
leg-press-horizontal|Leg press horizontal|agachamento|maquina|quadriceps|gluteo|150|5|0|
agachamento-bulgaro|Agachamento búlgaro|agachamento|halter|quadriceps|gluteo,gluteo-medio|150|2|1|Exige equilíbrio. Nem todo mundo se adapta.
afundo-halteres|Afundo com halteres|agachamento|halter|quadriceps|gluteo|150|2|1|
passada-halteres|Passada com halteres|agachamento|halter|quadriceps|gluteo|150|2|1|
agachamento-goblet|Agachamento goblet|agachamento|halter|quadriceps|gluteo,abdomen|120|2|0|
cadeira-extensora|Cadeira extensora|extensao_joelho|maquina|quadriceps||90|2.5|0|Isolador barato em fadiga. Pode ir perto da falha.
sissy-squat|Sissy squat|extensao_joelho|peso_corporal|quadriceps||90|1|0|
step-up|Step up no banco|agachamento|halter|quadriceps|gluteo|120|2|1|
# POSTERIOR E GLÚTEO
stiff-barra|Stiff com barra|dobradica_quadril|barra|posterior-de-coxa|gluteo,lombar|180|2.5|0|Joelho levemente flexionado e fixo.
stiff-halteres|Stiff com halteres|dobradica_quadril|halter|posterior-de-coxa|gluteo,lombar|180|2|0|Desça até sentir o posterior, não até o chão.
levantamento-terra-romeno|Levantamento terra romeno|dobradica_quadril|barra|posterior-de-coxa|gluteo,lombar|180|2.5|0|
levantamento-terra-sumo|Levantamento terra sumô|dobradica_quadril|barra|gluteo|quadriceps,adutores,lombar|240|5|0|
mesa-flexora|Mesa flexora|flexao_joelho|maquina|posterior-de-coxa||90|2.5|0|Quadril apoiado, sem levantar para roubar.
cadeira-flexora-sentada|Cadeira flexora sentada|flexao_joelho|maquina|posterior-de-coxa||90|2.5|0|Trabalha o posterior em maior alongamento.
flexora-em-pe|Flexora em pé|flexao_joelho|maquina|posterior-de-coxa||90|2.5|1|
nordic-curl|Nordic curl|flexao_joelho|peso_corporal|posterior-de-coxa||120|1|0|Desça o mais devagar que conseguir.
elevacao-pelvica|Elevação pélvica|dobradica_quadril|barra|gluteo|posterior-de-coxa|150|5|0|Queixo no peito, pausa de 1 segundo em cima.
elevacao-pelvica-maquina|Elevação pélvica na máquina|dobradica_quadril|maquina|gluteo|posterior-de-coxa|120|5|0|
coice-cabo|Coice no cabo|isolador|cabo|gluteo||90|2.5|1|
coice-maquina|Coice na máquina|isolador|maquina|gluteo||90|5|1|
cadeira-abdutora|Cadeira abdutora|isolador|maquina|gluteo-medio||60|5|0|Tronco levemente inclinado à frente.
cadeira-adutora|Cadeira adutora|isolador|maquina|adutores||60|5|0|
abducao-cabo|Abdução de quadril no cabo|isolador|cabo|gluteo-medio||60|2.5|1|
bom-dia|Bom dia|dobradica_quadril|barra|posterior-de-coxa|lombar,gluteo|150|2.5|0|Carga conservadora. Movimento exige técnica.
hiperextensao-lombar|Hiperextensão lombar|dobradica_quadril|peso_corporal|lombar|gluteo,posterior-de-coxa|90|2.5|0|
# PANTURRILHA
panturrilha-em-pe|Panturrilha em pé|isolador|maquina|panturrilha||90|5|0|2 segundos segurando embaixo, bem alongado.
panturrilha-sentado|Panturrilha sentado|isolador|maquina|soleo||90|5|0|Joelho dobrado privilegia o sóleo.
panturrilha-leg-press|Panturrilha no leg press|isolador|maquina|panturrilha|soleo|90|5|0|
panturrilha-halter|Panturrilha com halter|isolador|halter|panturrilha||60|2|1|
panturrilha-smith|Panturrilha no Smith|isolador|maquina|panturrilha||90|5|0|
# BÍCEPS
rosca-direta-barra|Rosca direta com barra|isolador|barra|biceps|antebraco|90|2.5|0|
rosca-direta-w|Rosca direta barra W|isolador|barra|biceps|antebraco|90|2.5|0|Pegada mais confortável para o punho.
rosca-alternada|Rosca alternada com halteres|isolador|halter|biceps|antebraco|90|2|1|
rosca-martelo|Rosca martelo|isolador|halter|biceps|antebraco|90|2|0|Pega neutra, pega também o braquial.
rosca-scott|Rosca scott|isolador|maquina|biceps||90|2.5|0|
rosca-concentrada|Rosca concentrada|isolador|halter|biceps||90|2|1|
rosca-cabo|Rosca no cabo|isolador|cabo|biceps|antebraco|90|2.5|0|Tensão constante ao longo de toda a amplitude.
rosca-inclinada|Rosca inclinada no banco|isolador|halter|biceps||90|2|0|Bíceps em maior alongamento.
rosca-inversa|Rosca inversa|isolador|barra|antebraco|biceps|90|2.5|0|
# TRÍCEPS
triceps-corda|Tríceps corda na polia|isolador|cabo|triceps||90|2.5|0|Cotovelo fixo ao lado do corpo.
triceps-barra-polia|Tríceps barra na polia|isolador|cabo|triceps||90|2.5|0|
triceps-testa|Tríceps testa|isolador|barra|triceps||90|2.5|0|
triceps-frances|Tríceps francês|isolador|halter|triceps||90|2|0|Cotovelo atrás da cabeça, posição alongada.
triceps-coice|Tríceps coice|isolador|halter|triceps||60|2|1|
triceps-banco|Mergulho no banco|empurrar_horizontal|peso_corporal|triceps|peitoral|90|2.5|0|
paralelas-triceps|Paralelas com tronco reto|empurrar_vertical|peso_corporal|triceps|peitoral|150|2.5|0|Tronco vertical joga a carga no tríceps.
supino-fechado|Supino fechado|empurrar_horizontal|barra|triceps|peitoral,deltoide-anterior|150|2.5|0|
triceps-maquina|Tríceps na máquina|isolador|maquina|triceps||90|5|0|
# CORE
prancha|Prancha|core|peso_corporal|abdomen|obliquos,lombar|60|1|0|Quadril alinhado, sem afundar.
prancha-lateral|Prancha lateral|core|peso_corporal|obliquos|abdomen|60|1|1|
abdominal-cabo|Abdominal no cabo|core|cabo|abdomen||60|2.5|0|
abdominal-maquina|Abdominal na máquina|core|maquina|abdomen||60|5|0|
elevacao-pernas-suspenso|Elevação de pernas suspenso|core|peso_corporal|abdomen|obliquos|90|1|0|
elevacao-joelhos-paralela|Elevação de joelhos na paralela|core|peso_corporal|abdomen||60|1|0|
abdominal-supra|Abdominal supra no solo|core|peso_corporal|abdomen||45|1|0|
rotacao-cabo|Rotação de tronco no cabo|core|cabo|obliquos|abdomen|60|2.5|1|
ab-wheel|Ab wheel|core|outro|abdomen|obliquos,lombar|90|1|0|
farmer-walk|Farmer walk|carregamento|halter|antebraco|trapezio,abdomen|120|2|0|
"""

def parse():
    linhas = []
    for raw in RAW.strip().split("\n"):
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        partes = raw.split("|")
        if len(partes) != 10:
            raise SystemExit("linha malformada (%d campos): %s" % (len(partes), raw))
        linhas.append(partes)
    return linhas

def esc(v):
    return v.replace("'", "''")

def main():
    dados = parse()
    ids = [d[0] for d in dados]
    if len(ids) != len(set(ids)):
        dupes = {i for i in ids if ids.count(i) > 1}
        raise SystemExit("slugs duplicados: %s" % dupes)

    validos = {m[0] for m in MUSCLES}
    out = []
    out.append("-- Seed do catálogo de exercícios. Gerado por scripts/gerar_seed.py.")
    out.append("-- Idempotente: pode rodar mais de uma vez sem duplicar.")
    out.append("")
    out.append("insert into public.muscles (id, name, region, sort_order) values")
    out.append(",\n".join(
        "  ('%s', '%s', '%s', %d)" % (m[0], esc(m[1]), m[2], m[3]) for m in MUSCLES
    ) + "\non conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;")
    out.append("")

    linhas_ex = []
    linhas_mus = []
    for slug, nome, padrao, equip, prim, sec, rest, passo, uni, dica in dados:
        cue = "'%s'" % esc(dica) if dica else "null"
        linhas_ex.append(
            "  ('%s', '%s', '%s', '%s', %s, %s, %s, %s)"
            % (slug, esc(nome), padrao, equip, "true" if uni == "1" else "false", rest, passo, cue)
        )
        for grupo, papel, peso in ((prim, "primario", "1.00"), (sec, "secundario", "0.50")):
            for m in [x for x in grupo.split(",") if x]:
                if m not in validos:
                    raise SystemExit("músculo desconhecido '%s' em %s" % (m, slug))
                linhas_mus.append("  ('%s', '%s', '%s', %s)" % (slug, m, papel, peso))

    out.append("insert into public.exercises")
    out.append("  (slug, name, pattern, equipment, is_unilateral, default_rest_seconds, load_step_kg, cue)")
    out.append("values")
    out.append(",\n".join(linhas_ex))
    out.append("on conflict (slug) do update set")
    out.append("  name = excluded.name, pattern = excluded.pattern, equipment = excluded.equipment,")
    out.append("  is_unilateral = excluded.is_unilateral, default_rest_seconds = excluded.default_rest_seconds,")
    out.append("  load_step_kg = excluded.load_step_kg, cue = excluded.cue;")
    out.append("")
    out.append("insert into public.exercise_muscles (exercise_id, muscle_id, role, contribution)")
    out.append("select e.id, v.muscle_id, v.role::muscle_role, v.contribution")
    out.append("from (values")
    out.append(",\n".join(linhas_mus))
    out.append(") as v(slug, muscle_id, role, contribution)")
    out.append("join public.exercises e on e.slug = v.slug")
    out.append("on conflict (exercise_id, muscle_id) do update set")
    out.append("  role = excluded.role, contribution = excluded.contribution;")
    out.append("")

    destino = pathlib.Path("supabase/seed/0003_exercises_seed.sql")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(out) + "\n", encoding="utf-8")

    ts = gerar_ts(dados)
    print("exercícios: %d" % len(dados))
    print("vínculos musculares: %d" % len(linhas_mus))
    print("músculos: %d" % len(MUSCLES))
    print("arquivos: %s, %s" % (destino, ts))


def ts_str(v):
    """String TypeScript entre aspas duplas, com escape."""
    return '"%s"' % v.replace("\\", "\\\\").replace('"', '\\"')


def gerar_ts(dados):
    """Catálogo dentro do app, para os dados no aparelho.

    O id do exercício global é o próprio slug: estável entre versões do
    catálogo, e o histórico guardado no aparelho aponta para ele.
    """
    out = []
    out.append("/* Gerado por scripts/gerar_seed.py. Não edite à mão: edite o RAW do script. */")
    out.append('import type { CatalogExercise, Muscle } from "./types";')
    out.append("")
    out.append("export const MUSCLES: Muscle[] = [")
    for m in MUSCLES:
        out.append("  { id: %s, name: %s, region: %s, sortOrder: %d }," % (ts_str(m[0]), ts_str(m[1]), ts_str(m[2]), m[3]))
    out.append("];")
    out.append("")
    out.append("export const CATALOG: CatalogExercise[] = [")
    for slug, nome, padrao, equip, prim, sec, rest, passo, uni, dica in dados:
        musculos = ["{ muscleId: %s, role: \"primario\" }" % ts_str(m) for m in prim.split(",") if m]
        musculos += ["{ muscleId: %s, role: \"secundario\" }" % ts_str(m) for m in sec.split(",") if m]
        out.append("  {")
        out.append("    id: %s," % ts_str(slug))
        out.append("    name: %s," % ts_str(nome))
        out.append("    pattern: %s," % ts_str(padrao))
        out.append("    equipment: %s," % ts_str(equip))
        out.append("    isUnilateral: %s," % ("true" if uni == "1" else "false"))
        out.append("    defaultRestSeconds: %s," % rest)
        out.append("    loadStepKg: %s," % passo)
        out.append("    cue: %s," % (ts_str(dica) if dica else "null"))
        out.append("    muscles: [%s]," % ", ".join(musculos))
        out.append("  },")
    out.append("];")
    out.append("")

    destino = pathlib.Path("src/core/data/catalog.ts")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(out), encoding="utf-8")
    return destino

if __name__ == "__main__":
    main()

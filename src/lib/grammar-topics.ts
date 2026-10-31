import type { Level, Language } from './types.ts'

export const ALL_GRAMMAR_TOPICS = 'Todos los temas (variados)'
export const CUSTOM_GRAMMAR_TOPIC = 'Otro tema…'

// Broad CEFR-aligned progression; recurring concepts become more complex at higher levels.
// Labels are sent to the sentence generator and can be customized by the user.
export const GRAMMAR_TOPICS: Record<Level, readonly string[]> = {
  A1: [
    'Présent: être y avoir',
    'Presente de verbos regulares (-er, -ir)',
    'Verbos irregulares frecuentes: aller, faire, venir',
    'Artículos definidos e indefinidos',
    'Género y plural de sustantivos',
    'Concordancia básica de adjetivos',
    'Negación: ne... pas',
    'Preguntas sencillas: est-ce que, où, combien',
    'Adjetivos posesivos y demostrativos',
    'Pronombres personales sujeto',
    'Preposiciones de lugar y de tiempo',
    'Futur proche: aller + infinitivo',
    'Verbos pronominales cotidianos',
    'La hora, las fechas y las cantidades',
    'Il y a, c’est e il est'
  ],
  A2: [
    'Passé composé con avoir y être',
    'Imparfait: descripciones y hábitos',
    'Passé composé vs imparfait',
    'Futur simple',
    'Condicional de cortesía',
    'Pronombres COD: le, la, les',
    'Pronombres COI: lui, leur',
    'Pronombres en e y',
    'Verbos pronominales en pasado',
    'Comparativos y superlativos',
    'Relativos básicos: qui, que, où',
    'Negación: ne... plus, ne... jamais, ne... rien',
    'Expresión de duración: depuis, pendant, il y a',
    'Imperativo y pronombres',
    'Cantidad, partitivos y adverbios de frecuencia'
  ],
  B1: [
    'Subjonctif présent: deseo, necesidad y duda',
    'Condicional e hipótesis con si',
    'Plus-que-parfait',
    'Condicional pasado y arrepentimiento',
    'Discurso indirecto en presente y pasado',
    'Relativos: dont, ce qui, ce que',
    'Pronombres relativos compuestos: lequel',
    'Concordancia del participio pasado',
    'Expresión de causa y consecuencia',
    'Expresión de finalidad: pour que, afin de',
    'Voz pasiva',
    'Conectores de tiempo y orden',
    'Oposición y concesión: même si, pourtant',
    'Pronombres dobles y orden de complementos',
    'Gerundio: en + participe présent'
  ],
  B2: [
    'Subjuntivo en construcciones complejas',
    'Subjonctif passé',
    'Concesión: bien que, quoique, malgré',
    'Hipótesis y tiempos compuestos con si',
    'Conectores de argumentación',
    'Relativos compuestos: auquel, duquel, lesquels',
    'Nominalización y estilo formal',
    'Discurso indirecto avanzado y concordancia temporal',
    'Voz pasiva y construcciones impersonales',
    'Expresión de condición y restricción',
    'Causa, consecuencia y finalidad matizadas',
    'Participio presente y adjetivo verbal',
    'Oposición, comparación y matices',
    'Negaciones complejas y restricciones',
    'Reformulación y precisión léxica'
  ],
  C1: [
    'Concesión: bien que, quoique, avoir beau',
    'Hipótesis y matices del condicional',
    'Subjonctif passé y construcciones impersonales',
    'Conectores argumentativos y registro formal',
    'Nominalización y reformulación precisa',
    'Discurso indirecto y cambios de perspectiva',
    'Relaciones de causa y consecuencia avanzadas',
    'Modismos y colocaciones frecuentes',
    'Síntesis y argumentación académica',
    'Concordancia avanzada y estructura de la frase',
    'Inversión, énfasis y mise en relief',
    'Condición restrictiva y matices de duda',
    'Expresión de reservas y diplomacia',
    'Estructuras participiales y subordinación',
    'Registro oral y escrito: reformular con naturalidad'
  ],
  C2: [
    'Matices semánticos, connotaciones y registro',
    'Concesión enfática: quand bien même',
    'Giros idiomáticos y expresiones figuradas',
    'Estilo literario, inversión y énfasis',
    'Atenuación, ironía y formulaciones diplomáticas',
    'Articulación lógica de argumentos complejos',
    'Vocabulario abstracto y precisión léxica',
    'Colocaciones y sintaxis de registro elevado',
    'Paráfrasis y reformulación elegante',
    'Expresión de reservas y razonamiento crítico',
    'Subordinadas complejas e implicaturas',
    'Matices de modalidades, hipótesis y concesión',
    'Variación entre registros oral, académico y literario',
    'Elipsis y construcciones enfáticas avanzadas',
    'Argumentación persuasiva con precisión estilística'
  ]
}

export function topicsForLevel(level: Level, language: Language = 'fr'): readonly string[] {
  return language === 'en' ? ENGLISH_GRAMMAR_TOPICS[level] : GRAMMAR_TOPICS[level]
}

export function selectedGrammarTopic(selection: string, customTopic: string): string {
  return selection === CUSTOM_GRAMMAR_TOPIC ? customTopic.trim() : selection
}


// Core structures by CEFR level. Labels and exercise instructions are Spanish for the learner.
export const ENGLISH_GRAMMAR_TOPICS: Record<Level, readonly string[]> = {
  A1: ['To be: afirmación y negación','Have got y posesión','Present simple: rutinas','Pronombres personales y posesivos','Artículos a / an / the','There is / there are','Plurales y demostrativos','Preguntas con do y does','Preposiciones de lugar','Can / cannot y habilidades','Present continuous','Horas y fechas','Adverbios de frecuencia','Some / any','Imperativo y peticiones'],
  A2: ['Past simple: verbos regulares e irregulares','Past continuous','Past simple frente a past continuous','Present perfect: experiencias','Comparativos y superlativos','Will frente a going to','Much / many / a lot of','Should / must / have to','First conditional','Infinitivo y gerundio básicos','Pronombres objeto','Preposiciones de tiempo','Since / for','Question tags básicas','Used to: hábitos pasados'],
  B1: ['Present perfect frente a past simple','Present perfect continuous','Past perfect','Second conditional','Voz pasiva básica','Reported speech','Relativos who / which / that','Modal verbs: deducción','Gerundio e infinitivo','Although / despite / however','Phrasal verbs habituales','So / such / too / enough','Wish: deseos','Question tags','Conectores de causa y resultado'],
  B2: ['Third conditional','Mixed conditionals','Modales perfectos: must have / might have','Voz pasiva avanzada','Reported speech avanzado','Relativos defining y non-defining','Wish / if only','Had better / would rather','Inversiones con not only / never','Cleft sentences','Future perfect y future continuous','Participle clauses','Colocaciones y phrasal verbs','Conectores concesivos','Registro formal e informal'],
  C1: ['Inversión negativa: rarely, hardly, no sooner','Condicionales avanzados e inversión','Modalidad, inferencia y grado de certeza','Nominalización y estilo académico','Participle clauses complejas','Cleft sentences y énfasis','Fronting y estructuras marcadas','Conectores argumentativos','Colocaciones avanzadas','Phrasal verbs idiomáticos','Hedging y cortesía','Reported speech y cambio de perspectiva','Aspecto y tiempos perfectos','Reformulación precisa','Idioms y registro'],
  C2: ['Matices pragmáticos y connotación','Inversión y énfasis estilístico','Elipsis y estructuras avanzadas','Colocaciones poco frecuentes pero naturales','Idioms en contexto','Hedging y diplomacia','Ironía y dobles sentidos','Registro académico y coloquial','Argumentación sofisticada','Modalidad y grado de compromiso','Tiempos verbales con matices narrativos','Paráfrasis idiomática y precisión','Subordinación y cohesión','Intertextualidad y estilo','Reformulación elegante sin artificios']
}

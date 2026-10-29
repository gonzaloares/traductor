-- Run against a dedicated Supabase project (do not reuse LexiTrack's database).
-- Restricted RLS: browser clients MUST NOT read/write data via PostgREST.
-- Only the Supabase Edge Function, using its private service-role credential,
-- may access the table after verifying a signed Parole session.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sentences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spanish_text TEXT NOT NULL,
  reference_french TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  grammar_topic TEXT NOT NULL,
  source TEXT DEFAULT 'seed' CHECK (source IN ('seed', 'ai_generated')),
  mastery_score INTEGER DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 5),
  times_practiced INTEGER DEFAULT 0 CHECK (times_practiced >= 0),
  last_feedback TEXT,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentences DROP CONSTRAINT IF EXISTS sentences_level_check;
ALTER TABLE public.sentences ADD CONSTRAINT sentences_level_check
  CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
DROP POLICY IF EXISTS "single_user_open_access" ON public.sentences;
-- No anon/authenticated RLS policies are intentionally created.
REVOKE ALL ON TABLE public.sentences FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS sentences_review_index
  ON public.sentences (next_review_at, mastery_score);
CREATE INDEX IF NOT EXISTS sentences_level_review_index
  ON public.sentences (level, next_review_at, mastery_score);
CREATE UNIQUE INDEX IF NOT EXISTS sentences_unique_level_spanish
  ON public.sentences (level, spanish_text);

-- Automatically detected spelling mistakes, reviewed separately from sentence SRS.
-- A unique normalized word key prevents repeated cards for the same word.
CREATE TABLE IF NOT EXISTS public.orthography_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_key TEXT NOT NULL UNIQUE,
  correct_word TEXT NOT NULL,
  wrong_example TEXT NOT NULL,
  meaning_es TEXT NOT NULL,
  context_fr TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  mastery_score SMALLINT NOT NULL DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 5),
  times_practiced INTEGER NOT NULL DEFAULT 0 CHECK (times_practiced >= 0),
  misspellings_count INTEGER NOT NULL DEFAULT 1 CHECK (misspellings_count >= 1),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','dismissed')),
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.orthography_words ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.orthography_words FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orthography_words TO service_role;
CREATE INDEX IF NOT EXISTS orthography_words_review_idx ON public.orthography_words (state, next_review_at, mastery_score);

-- First-attempt score history used by the Progreso screen.
-- Re-trying a corrected sentence uses the same practice_id and is ignored.
-- The client cannot read this table directly; only the authenticated Edge Function can.
CREATE TABLE IF NOT EXISTS public.practice_scores (
  practice_id UUID PRIMARY KEY,
  sentence_id UUID NOT NULL REFERENCES public.sentences(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.practice_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.practice_scores FROM anon, authenticated;
GRANT SELECT, INSERT ON public.practice_scores TO service_role;
CREATE INDEX IF NOT EXISTS practice_scores_date_idx ON public.practice_scores (created_at, practice_id);
CREATE INDEX IF NOT EXISTS practice_scores_level_date_idx ON public.practice_scores (level, created_at, practice_id);

-- 60 manually curated examples: 30 A1, 10 A2, 10 B1, 10 B2.
-- Repeatable seed: existing rows and user progress remain unchanged.
INSERT INTO public.sentences (spanish_text, reference_french, level, grammar_topic, source)
VALUES
  ('Cuando era pequeño, jugaba en el jardín todos los días.', 'Quand j’étais petit, je jouais dans le jardin tous les jours.', 'A2', 'Imparfait: hábitos en el pasado', 'seed'),
  ('Ayer llovía cuando salimos del cine.', 'Hier, il pleuvait quand nous sommes sortis du cinéma.', 'A2', 'Passé composé vs imparfait', 'seed'),
  ('Esta mañana me he levantado tarde y me he duchado rápidamente.', 'Ce matin, je me suis levé tard et je me suis douché rapidement.', 'A2', 'Verbos pronominales en passé composé', 'seed'),
  ('¿Tienes pan? Sí, todavía tengo un poco.', 'Tu as du pain ? Oui, j’en ai encore un peu.', 'A2', 'Pronombre EN: cantidad', 'seed'),
  ('¿Vas a la biblioteca? Sí, voy después de comer.', 'Tu vas à la bibliothèque ? Oui, j’y vais après le déjeuner.', 'A2', 'Pronombre Y: lugar', 'seed'),
  ('No veo a mis vecinos desde hace dos semanas.', 'Je ne vois pas mes voisins depuis deux semaines.', 'A2', 'Negación y depuis', 'seed'),
  ('Le he dado las llaves a mi hermana.', 'Je lui ai donné les clés.', 'A2', 'Pronombre COI: lui', 'seed'),
  ('¿Has leído este libro? No, todavía no lo he leído.', 'Tu as lu ce livre ? Non, je ne l’ai pas encore lu.', 'A2', 'Pronombre COD y negación', 'seed'),
  ('Ya no trabajo los sábados, pero todavía estudio los domingos.', 'Je ne travaille plus le samedi, mais j’étudie encore le dimanche.', 'A2', 'Negación ne... plus', 'seed'),
  ('Nunca nos acostamos antes de las diez durante las vacaciones.', 'Nous ne nous couchons jamais avant dix heures pendant les vacances.', 'A2', 'Verbo pronominal y ne... jamais', 'seed'),

  ('Si tuviera más tiempo, leería un libro en francés cada semana.', 'Si j’avais plus de temps, je lirais un livre en français chaque semaine.', 'B1', 'Si + imparfait y conditionnel présent', 'seed'),
  ('Quiero que vengas conmigo aunque estés cansado.', 'Je veux que tu viennes avec moi, même si tu es fatigué.', 'B1', 'Subjonctif después de vouloir que', 'seed'),
  ('Busco una persona que sepa explicar esta regla.', 'Je cherche quelqu’un qui sache expliquer cette règle.', 'B1', 'Subjonctif: antecedente no identificado', 'seed'),
  ('Las cartas que escribí ayer ya han llegado.', 'Les lettres que j’ai écrites hier sont déjà arrivées.', 'B1', 'Concordancia del participio con COD previo', 'seed'),
  ('Las películas que vimos nos gustaron mucho.', 'Les films que nous avons vus nous ont beaucoup plu.', 'B1', 'Accord du participe passé y plaire', 'seed'),
  ('No tengo ninguna idea de lo que pasó.', 'Je n’ai aucune idée de ce qui s’est passé.', 'B1', 'Negación ne... aucun y ce qui', 'seed'),
  ('Le he hablado de este problema, pero no me ha respondido.', 'Je lui ai parlé de ce problème, mais il ne m’a pas répondu.', 'B1', 'Pronombres COI y passé composé', 'seed'),
  ('Ese es el restaurante donde nos conocimos hace tres años.', 'C’est le restaurant où nous nous sommes rencontrés il y a trois ans.', 'B1', 'Relativo où y verbos pronominales', 'seed'),
  ('¿Tienes ganas de ir? Sí, tengo muchas ganas.', 'Tu as envie d’y aller ? Oui, j’en ai très envie.', 'B1', 'Pronombres EN e Y', 'seed'),
  ('Es una mujer que habla tres idiomas y cuyo hijo vive en Lyon.', 'C’est une femme qui parle trois langues et dont le fils habite à Lyon.', 'B1', 'Relativos qui y dont', 'seed'),

  ('Aunque haya estudiado mucho, no estoy seguro de haberlo entendido todo.', 'Bien que j’aie beaucoup étudié, je ne suis pas sûr d’avoir tout compris.', 'B2', 'Subjonctif passé y infinitif passé', 'seed'),
  ('Si me lo hubieras dicho antes, habría podido ayudarte.', 'Si tu me l’avais dit plus tôt, j’aurais pu t’aider.', 'B2', 'Si + plus-que-parfait y conditionnel passé', 'seed'),
  ('Las explicaciones que nos dieron no nos convencieron.', 'Les explications qu’ils nous ont données ne nous ont pas convaincus.', 'B2', 'Acuerdo del participio y doble pronombre', 'seed'),
  ('No conozco a nadie que pueda resolverlo sin ayuda.', 'Je ne connais personne qui puisse le résoudre sans aide.', 'B2', 'Negación ne... personne y subjonctif', 'seed'),
  ('Aquello de lo que más me arrepiento es de no haberle escuchado.', 'Ce que je regrette le plus, c’est de ne pas l’avoir écouté.', 'B2', 'Ce que y infinitif passé', 'seed'),
  ('Hagas lo que hagas, asegúrate de que los demás lo sepan.', 'Quoi que tu fasses, assure-toi que les autres le sachent.', 'B2', 'Quoi que y subjonctif', 'seed'),
  ('Dudo que los documentos que enviaron hayan llegado a tiempo.', 'Je doute que les documents qu’ils ont envoyés soient arrivés à temps.', 'B2', 'Subjonctif passé y acuerdo del COD', 'seed'),
  ('Por mucho que insista, no conseguiré que cambien de opinión.', 'J’aurai beau insister, je ne parviendrai pas à les faire changer d’avis.', 'B2', 'Avoir beau y faire + infinitif', 'seed'),
  ('No solo se olvidó de llamarme, sino que tampoco respondió a mis mensajes.', 'Non seulement il a oublié de m’appeler, mais il n’a pas non plus répondu à mes messages.', 'B2', 'Non seulement... mais... non plus', 'seed'),
  ('El tema del que hablamos ayer es más complicado de lo que parece.', 'Le sujet dont nous avons parlé hier est plus compliqué qu’il n’y paraît.', 'B2', 'Relativo dont y comparativo con y', 'seed')
ON CONFLICT (level, spanish_text) DO NOTHING;

-- A1 starter phrases. Idempotent; existing SRS progress is kept.
INSERT INTO public.sentences (spanish_text, reference_french, grammar_topic, level, source)
VALUES
  ('Estoy en casa.', 'Je suis à la maison.', 'Être: presente y lugares', 'A1', 'seed'),
  ('Tengo dos hermanas.', 'J’ai deux sœurs.', 'Avoir y números', 'A1', 'seed'),
  ('Ella tiene quince años.', 'Elle a quinze ans.', 'Avoir: expresar la edad', 'A1', 'seed'),
  ('Nosotros somos españoles.', 'Nous sommes espagnols.', 'Être: nacionalidades y plural', 'A1', 'seed'),
  ('¿Cómo te llamas?', 'Comment tu t’appelles ?', 'Preguntas y verbos pronominales', 'A1', 'seed'),
  ('Me llamo Lucas.', 'Je m’appelle Lucas.', 'Se présenter: s’appeler', 'A1', 'seed'),
  ('Hoy hace frío.', 'Aujourd’hui, il fait froid.', 'El tiempo: il fait', 'A1', 'seed'),
  ('Hay un libro sobre la mesa.', 'Il y a un livre sur la table.', 'Il y a y preposiciones', 'A1', 'seed'),
  ('Tengo hambre.', 'J’ai faim.', 'Expresiones con avoir', 'A1', 'seed'),
  ('No tengo coche.', 'Je n’ai pas de voiture.', 'Negación ne... pas', 'A1', 'seed'),
  ('Mi hermana es médica.', 'Ma sœur est médecin.', 'Posesivos y profesiones', 'A1', 'seed'),
  ('Vamos al cine esta tarde.', 'Nous allons au cinéma cet après-midi.', 'Aller y preposiciones', 'A1', 'seed'),
  ('¿Dónde está la estación?', 'Où est la gare ?', 'Preguntar por lugares', 'A1', 'seed'),
  ('Esta camiseta es roja.', 'Ce tee-shirt est rouge.', 'Demostrativos y adjetivos', 'A1', 'seed'),
  ('Me gusta el café, pero no me gusta el té.', 'J’aime le café, mais je n’aime pas le thé.', 'Aimer y negación', 'A1', 'seed'),
  ('El perro está debajo de la mesa.', 'Le chien est sous la table.', 'Preposiciones de lugar', 'A1', 'seed'),
  ('Los niños juegan en el parque.', 'Les enfants jouent dans le parc.', 'Presente y artículos', 'A1', 'seed'),
  ('Quiero comprar una manzana.', 'Je veux acheter une pomme.', 'Vouloir + infinitivo', 'A1', 'seed'),
  ('¿Cuánto cuesta este libro?', 'Combien coûte ce livre ?', 'Preguntar el precio', 'A1', 'seed'),
  ('Mañana voy a estudiar francés.', 'Demain, je vais étudier le français.', 'Futuro próximo: aller + infinitivo', 'A1', 'seed'),
  ('¿Qué hora es?', 'Quelle heure est-il ?', 'Preguntar la hora', 'A1', 'seed'),
  ('Mi madre trabaja en un hospital.', 'Ma mère travaille dans un hôpital.', 'Presente y profesiones', 'A1', 'seed'),
  ('Estamos cansados.', 'Nous sommes fatigués.', 'Concordancia de adjetivos', 'A1', 'seed'),
  ('¿Puedes hablar más despacio?', 'Tu peux parler plus lentement ?', 'Pouvoir + infinitivo', 'A1', 'seed'),
  ('Ella no entiende la pregunta.', 'Elle ne comprend pas la question.', 'Negación y presente', 'A1', 'seed'),
  ('Son las ocho y media.', 'Il est huit heures et demie.', 'La hora', 'A1', 'seed'),
  ('¿Dónde viven tus padres?', 'Où habitent tes parents ?', 'Preguntas y posesivos', 'A1', 'seed'),
  ('Mi teléfono está en mi bolso.', 'Mon téléphone est dans mon sac.', 'Posesivos y lugar', 'A1', 'seed'),
  ('Él bebe agua.', 'Il boit de l’eau.', 'Partitivos: de l’', 'A1', 'seed'),
  ('Siempre me levanto a las siete.', 'Je me lève toujours à sept heures.', 'Pronominales y frecuencia', 'A1', 'seed')
ON CONFLICT (level, spanish_text) DO NOTHING;

-- Initial C1-C2 exercises (18 at each level).
INSERT INTO public.sentences (spanish_text, reference_french, level, grammar_topic, source)
VALUES
  ('A medida que avanzaba la negociación, resultaba cada vez más difícil llegar a un acuerdo.', 'À mesure que la négociation avançait, il devenait de plus en plus difficile de parvenir à un accord.', 'C1', 'Progresión y relación temporal', 'seed'),
  ('A menos que cambien las circunstancias, mantendremos la decisión que tomamos ayer.', 'À moins que les circonstances ne changent, nous maintiendrons la décision que nous avons prise hier.', 'C1', 'À moins que y subjonctif', 'seed'),
  ('Aunque haya releído el informe varias veces, sigo sin entender por qué se rechazó la propuesta.', 'Bien que j’aie relu le rapport plusieurs fois, je ne comprends toujours pas pourquoi la proposition a été rejetée.', 'C1', 'Subjonctif passé y concesión', 'seed'),
  ('Aunque los resultados parezcan alentadores, sería prematuro sacar conclusiones definitivas.', 'Bien que les résultats semblent encourageants, il serait prématuré de tirer des conclusions définitives.', 'C1', 'Concesión y condicional', 'seed'),
  ('Con tal de que todos colaboren, podremos terminar el proyecto antes de lo previsto.', 'Pourvu que tout le monde participe, nous pourrons achever le projet plus tôt que prévu.', 'C1', 'Pourvu que y subjonctif', 'seed'),
  ('En lugar de justificar su retraso, debería habernos avisado de que no llegaría a tiempo.', 'Au lieu de justifier son retard, il aurait dû nous prévenir qu’il n’arriverait pas à temps.', 'C1', 'Condicional pasado y discurso indirecto', 'seed'),
  ('Fue después de comparar ambas versiones cuando comprendí la magnitud del malentendido.', 'Ce n’est qu’après avoir comparé les deux versions que j’ai compris l’ampleur du malentendu.', 'C1', 'Mise en relief y restricción', 'seed'),
  ('Habría sido preferible que nos hubieran informado antes de anunciar los cambios.', 'Il aurait été préférable qu’on nous ait informés avant d’annoncer les changements.', 'C1', 'Condicional pasado y subjonctif passé', 'seed'),
  ('Lejos de resolver el conflicto, su intervención acabó agravándolo.', 'Loin de résoudre le conflit, son intervention a fini par l’aggraver.', 'C1', 'Loin de y consecuencia', 'seed'),
  ('Me sorprende que nadie haya planteado esta cuestión hasta ahora.', 'Je suis surpris que personne n’ait soulevé cette question jusqu’à présent.', 'C1', 'Subjonctif passé', 'seed'),
  ('No basta con reconocer los errores; también hay que tomar medidas para corregirlos.', 'Il ne suffit pas de reconnaître les erreurs ; encore faut-il prendre des mesures pour les corriger.', 'C1', 'Encore faut-il e inversión', 'seed'),
  ('No es que dude de su sinceridad, sino que su versión contradice los hechos.', 'Ce n’est pas que je doute de sa sincérité, mais sa version contredit les faits.', 'C1', 'Negación matizada y subjonctif', 'seed'),
  ('No podemos descartar que esta decisión tenga efectos que todavía no hemos previsto.', 'Nous ne pouvons pas exclure que cette décision ait des effets que nous n’avons pas encore anticipés.', 'C1', 'Subjonctif y relativos', 'seed'),
  ('Por más razonable que parezca esta solución, no podemos ignorar sus posibles consecuencias.', 'Aussi raisonnable que paraisse cette solution, nous ne pouvons pas ignorer ses conséquences possibles.', 'C1', 'Aussi… que y subjonctif', 'seed'),
  ('Por mucho que se lo explique, se niega a reconocer que podría estar equivocado.', 'J’ai beau le lui expliquer, il refuse d’admettre qu’il pourrait se tromper.', 'C1', 'Avoir beau y pronombres', 'seed'),
  ('Por un lado, la medida simplificaría el proceso; por otro, podría generar desigualdades.', 'D’une part, la mesure simplifierait la procédure ; d’autre part, elle pourrait engendrer des inégalités.', 'C1', 'Argumentación y oposición', 'seed'),
  ('Sea cual sea el desenlace, tendremos que asumir las consecuencias de nuestras decisiones.', 'Quelle que soit l’issue, nous devrons assumer les conséquences de nos décisions.', 'C1', 'Quelle que soit y subjonctif', 'seed'),
  ('Si me lo hubieras advertido antes, habría podido prepararme para la reunión.', 'Si tu m’avais prévenu plus tôt, j’aurais pu me préparer à la réunion.', 'C1', 'Hipótesis irreal del pasado', 'seed'),
  ('A falta de pruebas concluyentes, convendría abstenerse de formular acusaciones precipitadas.', 'Faute de preuves concluantes, il conviendrait de s’abstenir de porter des accusations hâtives.', 'C2', 'Faute de y registro formal', 'seed'),
  ('A fuerza de aplazar las decisiones difíciles, terminó por perder la confianza de sus colaboradores.', 'À force de repousser les décisions difficiles, il a fini par perdre la confiance de ses collaborateurs.', 'C2', 'À force de y locuciones', 'seed'),
  ('A juzgar por sus declaraciones, parece haber cambiado de opinión sin reconocerlo abiertamente.', 'À en juger par ses déclarations, il semble avoir changé d’avis sans le reconnaître ouvertement.', 'C2', 'A juzgar por y registro', 'seed'),
  ('Antes de exigir más sacrificios, habría que preguntarse si los ya realizados han servido de algo.', 'Avant d’exiger davantage de sacrifices, encore faudrait-il se demander si ceux déjà consentis ont servi à quelque chose.', 'C2', 'Encore faudrait-il y argumentación', 'seed'),
  ('Hay que reconocer que las buenas intenciones no siempre bastan para obtener buenos resultados.', 'Force est de constater que les bonnes intentions ne suffisent pas toujours à obtenir de bons résultats.', 'C2', 'Force est de constater', 'seed'),
  ('Incluso si dispusieras de todos los medios necesarios, nada garantizaría que el proyecto saliera adelante.', 'Quand bien même tu disposerais de tous les moyens nécessaires, rien ne garantirait que le projet aboutisse.', 'C2', 'Quand bien même y subjonctif', 'seed'),
  ('Incluso suponiendo que sus cifras sean exactas, las conclusiones que extrae son discutibles.', 'Même à supposer que ses chiffres soient exacts, les conclusions qu’il en tire restent discutables.', 'C2', 'Hipótesis y en', 'seed'),
  ('Lejos de disipar las dudas, su explicación no hizo sino alimentarlas.', 'Loin de dissiper les doutes, son explication n’a fait que les alimenter.', 'C2', 'Restricción y énfasis', 'seed'),
  ('Lo que al principio parecía una simple discrepancia acabó revelándose como un conflicto profundo.', 'Ce qui semblait au départ n’être qu’un simple désaccord s’est finalement révélé être un conflit profond.', 'C2', 'Construcción de matiz y énfasis', 'seed'),
  ('Me guardaría mucho de afirmar que el problema está resuelto mientras queden tantas incógnitas.', 'Je me garderais bien d’affirmer que le problème est résolu tant qu’il subsiste autant d’incertitudes.', 'C2', 'Reserva y matiz', 'seed'),
  ('No deja de ser cierto que, pese a sus limitaciones, el acuerdo representa un avance.', 'Il n’en demeure pas moins que, malgré ses limites, cet accord constitue un progrès.', 'C2', 'Il n’en demeure pas moins', 'seed'),
  ('No fue tanto lo que dijo como la manera en que lo dijo lo que provocó la polémica.', 'Ce n’est pas tant ce qu’il a dit que la manière dont il l’a dit qui a suscité la polémique.', 'C2', 'Ce n’est pas tant… que', 'seed'),
  ('No se trata tanto de demostrar que tiene razón como de comprender por qué los demás discrepan.', 'Il s’agit moins de démontrer qu’il a raison que de comprendre pourquoi les autres ne sont pas de son avis.', 'C2', 'Estructura menos… que', 'seed'),
  ('Por convincente que resulte su argumento, sigue sin responder a la pregunta fundamental.', 'Aussi convaincant que soit son argument, il ne répond toujours pas à la question fondamentale.', 'C2', 'Concesión avanzada', 'seed'),
  ('Por muy legítimas que sean sus preocupaciones, no justifican que se impongan decisiones sin debate.', 'Aussi légitimes que soient ses inquiétudes, elles ne justifient pas que des décisions soient imposées sans débat.', 'C2', 'Aussi… que y modalización', 'seed'),
  ('Que haya pedido disculpas no significa, sin embargo, que haya reconocido su responsabilidad.', 'Qu’il ait présenté ses excuses ne signifie pas pour autant qu’il ait reconnu sa responsabilité.', 'C2', 'Pour autant y subjonctif', 'seed'),
  ('Queda por saber si esta aparente mejora se mantendrá una vez desaparezcan las ayudas.', 'Reste à savoir si cette amélioration apparente se maintiendra une fois les aides supprimées.', 'C2', 'Reste à savoir y elipsis', 'seed'),
  ('Se expresó con cautela para evitar que sus palabras se interpretaran como una crítica.', 'Il s’est exprimé avec prudence, de crainte que ses propos ne soient interprétés comme une critique.', 'C2', 'De crainte que y ne explétif', 'seed')
ON CONFLICT (level, spanish_text) DO NOTHING;

-- Run against a dedicated Supabase project (do not reuse LexiTrack's database).
-- Restricted RLS: browser clients MUST NOT read/write data via PostgREST.
-- Only the Supabase Edge Function, using its private service-role credential,
-- may access the table after verifying a signed Parole session.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sentences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spanish_text TEXT NOT NULL,
  reference_french TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2')),
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
  CHECK (level IN ('A1', 'A2', 'B1', 'B2'));
DROP POLICY IF EXISTS "single_user_open_access" ON public.sentences;
-- No anon/authenticated RLS policies are intentionally created.
REVOKE ALL ON TABLE public.sentences FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS sentences_review_index
  ON public.sentences (next_review_at, mastery_score);
CREATE INDEX IF NOT EXISTS sentences_level_review_index
  ON public.sentences (level, next_review_at, mastery_score);
CREATE UNIQUE INDEX IF NOT EXISTS sentences_unique_level_spanish
  ON public.sentences (level, spanish_text);

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

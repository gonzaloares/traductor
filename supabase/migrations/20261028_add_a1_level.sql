-- Add A1 without resetting existing A2-B2 sentences or repetition history.
-- Applied to the dedicated Parole project only.
ALTER TABLE public.sentences DROP CONSTRAINT IF EXISTS sentences_level_check;
ALTER TABLE public.sentences ADD CONSTRAINT sentences_level_check
  CHECK (level IN ('A1', 'A2', 'B1', 'B2'));

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

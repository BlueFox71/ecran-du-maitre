-- Remettre une séance à vide : ses objets, familles, inventaires et pochette.
-- Les états des personnages (character_seance), les lieux, les PNJ et la trame
-- ne bougent pas.
--
-- Écrit pour la séance 5 de « Chasse aux fantômes » (id 9), qui avait hérité
-- de tout à sa création, avant que chaque séance ait les siens (1.8.0).
--
-- À jouer application fermée, après une copie de projet.db :
--   python -c "import sqlite3; c=sqlite3.connect(r'<dossier>\.ecran-du-maitre\projet.db'); c.executescript(open('outils/vider-seance.sql', encoding='utf-8').read())"
PRAGMA foreign_keys = ON;
BEGIN;
DELETE FROM objet_placement WHERE session_id = 9;
DELETE FROM pochette        WHERE session_id = 9;
DELETE FROM pochette_onglet WHERE session_id = 9;
DELETE FROM inventaire      WHERE session_id = 9;
DELETE FROM objet           WHERE session_id = 9;
DELETE FROM objet_famille   WHERE session_id = 9;
COMMIT;

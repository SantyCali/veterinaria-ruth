-- Especies de campo (caballo, vaca, ternero, oveja, cabra, cerdo).
-- Se agregan solo para poder elegirlas al cargar una mascota: la clínica atiende
-- sobre todo caninos y felinos. Las claves 'perro' y 'gato' no cambian; en la app
-- se muestran como "Canino" y "Felino".
alter type public.pet_species add value if not exists 'equino'  before 'otro';
alter type public.pet_species add value if not exists 'bovino'  before 'otro';
alter type public.pet_species add value if not exists 'ovino'   before 'otro';
alter type public.pet_species add value if not exists 'caprino' before 'otro';
alter type public.pet_species add value if not exists 'porcino' before 'otro';

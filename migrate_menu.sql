-- Menyu nomlarini va kategoriyalarini o'zbek tiliga o'girish
-- Ishlab turgan server DB ga qo'llash uchun

UPDATE menu_items SET
  name = 'Palov',
  description = 'An''anaviy o''zbek palovi, guruch, sabzi va qo''y go''shti bilan',
  category = 'Asosiy taomlar'
WHERE name = 'Ош (Плов)';

UPDATE menu_items SET
  name = 'Samsa',
  description = 'Go''sht va piyoz bilan to''ldirilgan qatlamali pishiriq',
  category = 'Nonvoylik'
WHERE name = 'Самса';

UPDATE menu_items SET
  name = 'Lag''mon',
  description = 'Uy lapmasi va qovurilgan go''sht bilan sho''rva',
  category = 'Sho''rvalar'
WHERE name = 'Лагман';

UPDATE menu_items SET
  name = 'Manti',
  description = 'Go''sht va piyoz bilan bug''da pishirilgan manti',
  category = 'Asosiy taomlar'
WHERE name = 'Манты';

UPDATE menu_items SET
  name = 'Sho''rva',
  description = 'Qo''y go''shti va sabzavotlar bilan qaynagan sho''rva',
  category = 'Sho''rvalar'
WHERE name = 'Шурпа';

UPDATE menu_items SET
  name = 'Shashlik (porsiya)',
  description = 'Ko''mirda pishirilgan go''sht, non bilan beriladi',
  category = 'Grill'
WHERE name = 'Шашлык (порция)';

UPDATE menu_items SET
  name = 'Dimlama',
  description = 'Qozon ichida sabzavotlar bilan dim qilingan go''sht',
  category = 'Asosiy taomlar'
WHERE name = 'Димлама';

UPDATE menu_items SET
  name = 'Non',
  description = 'Tandirda yangi pishirilgan non',
  category = 'Nonvoylik'
WHERE name = 'Нон (лепёшка)';

UPDATE menu_items SET
  name = 'Yashil choy (choynak)',
  description = 'Xushbo''y yashil choy',
  category = 'Ichimliklar'
WHERE name = 'Чайник зелёного чая';

UPDATE menu_items SET
  name = 'Kompot',
  description = 'Quritilgan mevalardan tayyorlangan uy kompoti',
  category = 'Ichimliklar'
WHERE name = 'Компот';

UPDATE menu_items SET
  name = 'Mastava',
  description = 'Go''sht va sabzavotlar bilan guruch sho''rvasi',
  category = 'Sho''rvalar'
WHERE name = 'Мастава';

UPDATE menu_items SET
  name = 'Beshbarmaq',
  description = 'Uy lapmasi va piyoz bilan go''sht',
  category = 'Asosiy taomlar'
WHERE name = 'Бешбармак';

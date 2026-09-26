# ---------------------------------------------- #
#        Sounds and music definitions            #
#                                                #
# Чтоб?исключит?како?нить звук, следуе?      #
# поставит?ем?значение none. Можн?назначит?  #
# нескольк?звуков на одно событи?использу?    #
# синтакси?задани?массивов. Тогд?звук буде?  #
# равновероятн?выбираться из заданных варианто?#
# ---------------------------------------------- #

$Section Settings
  ; каки?сэмплы загружат?предварительно
  PreloadSamples        "None"
$EndOfSection

$Section Music
  $Section Menu
    File     "menu1.ogg"
    Loop     OFF
#    LoopPos  1529168
    volume   40
#    LoopPos  1533801
  $EndOfSection

  $Section Combat1
    File     "combat1.ogg"
    Loop     ON
    LoopPos  25403
  $EndOfSection

  $Section Combat2
    File     "combat2.ogg"
    Loop     ON
    LoopPos  734367
  $EndOfSection

  $Section Combat3
    File     "combat3.ogg"
    Loop     ON
    LoopPos  2625601
  $EndOfSection

$EndOfSection

$Section SoundEvents
  ; Эффект?выезжани?окон
  ShowEffect1           "showeff1.ogg"
  ShowEffect2           "showeff2.ogg,vol=30"
  HideEffect1           "hideeff1.ogg"
  HideEffect2           "hideeff2.ogg,vol=30"

  Helppage      "listhelp1.ogg,vol=20"
  Boom          "boom.ogg"

  Privatemsg    "din-din.ogg"
  Challenged    "ring.ogg"
  TournamentCreated "magic.ogg"

  ItemSelected   "btn2.ogg,vol=18"
  CampaignSelOpp "btn2.ogg,vol=25"

  TurnTime       "turntime.ogg"

  ; Момент нажати?кнопки
  Button1       "btn1.ogg,vol=50"
  ButtonM       "btnM.ogg,vol=90,pan=70"
  Button1l      "btn1.ogg,vol=50,pan=-60"
  Button1r      "btn1.ogg,vol=50,pan=60"
  Button2       "btn2.ogg,vol=50"
  Button2l      "btn2.ogg,vol=50,pan=-40"
  Button2r      "btn2.ogg,vol=50,pan=60"
  Button3       "btn3.ogg,vol=60"
  Button4       "btn4.ogg,vol=25"
  Button5       "btn5.ogg,vol=30"

  ; Момент отпускания кнопки
  ButtonUp      "none"

  ; Момент выбора кнопки
  ButtonOver    "none"

  ; Начало любо?дуэл?
  StartDuel     "none"

  ; Челове?выигра?дуэл??компьютера
  WinDuel       "none"

  ; Челове?проиграл дуэл?компьютеру
  LoseDuel      "none"

  ; Игро?получи?здоровье магическим способом
  CuredBySpell          "none"

  ; Игро?получи?магическое повреждени?
  DamagedBySpell        "none"

  ; Игро?пытается использовать карт? недоступну??незарегистрированной версии
  NotAvailable          "none"

  SummonCreature\Player  "summon1.ogg,pan=40,vol=50"
  SummonCreature\Opponent  "summon1.ogg,pan=-60,vol=50"
  SummonDropCard   "summondrop.wav"

  CreatureAttacks  "attack.ogg"

  Flame_Wave    "flamewave.ogg"
  Inferno       "inferno.ogg,vol=150"
  Armageddon    "Armageddon2.ogg,vol=150"
  Call_to_Thunder       "calltothunder.ogg,vol=75"
  Lightning_Bolt        "lightningbolt.ogg,vol=70"
  Meditation    "meditation.ogg, vol=35"
  Natures_Fury          "naturalfury.ogg,vol=200"
  Rejuvenation          "rejuvenation.ogg"
  Stone_Rain    "stonerain.ogg,vol=120"
  tornado       "tornado.ogg"
  Acidic_Rain           "acidicrain.ogg"

  Blood_Ritual          "bloodritual.ogg,vol=500"
  Dark_Ritual           "darkritual.ogg,vol=90"
  Cursed_Fog    "cursedfog.ogg"
  Drain_Soul           "drainsouls.ogg,vol=120"
  Chain_Lightning       "chainlightning.ogg"

  Divine_Intervention  "divineint.ogg,vol=25"
  Wrath_Of_God          "wrathofgod.ogg"
  Overtime            "overtime.ogg,vol=40"
  Cannonade           "cannonade.ogg,vol=80"
  Weakness            "weakness.ogg,vol=50"
  Poisonous_Cloud   "poisoncloud.ogg,vol=50"
  Doom_Bolt         "doombolt.ogg,vol=80"
  Madness           "madness.ogg"
  Hypnosis          "hypnosys.ogg"

  Natures_Ritual     "natureRit.ogg"
  Divine_Justice    "divJustice.ogg"
  Chaotic_Wave      "chaowave.ogg,vol=30"

  Rage_Of_Souls     "Rage_Of_Souls.ogg"
  Explosion         "explosion.ogg,vol=35"
  Power_Chains      "Power_Chains.ogg"
  Hellfire          "hellfire.ogg,vol=40"
  Healing_Spray     "Healing_Spray.ogg"
  Fireball          "Fireball.ogg,vol=40"
  Steal_Essence     "Steal_Essence.ogg,vol=40"
  Sacrifice         "Sacrifice.ogg"
  Mana_Burn         "Mana_Burn.ogg,vol=30"
  Ritual_Of_Glory   "Ritual_Of_Glory.ogg"
  Sonic_Boom        "Sonic_Boom.ogg,vol=50"
  Disintegrate      "Disintegrate.ogg,vol=35"
  Natural_Healing   "Natural_Healing.ogg"
  Poison            "Poison.ogg"
  Enrage            "Enrage.ogg,vol=35"
  Pump_Energy       "Pump_Energy.ogg,vol=30"
  Trumpet           "Trumpet.ogg,vol=40"
  Gaze              "Gaze.ogg,vol=50"
  Breathe_Fire      "Breathe_Fire.ogg"
  Move_Falcon       "Move_Falcon.ogg,vol=40"

  Hasten            "hasten.ogg,vol=50"
  Time_Stop          "time_stop.ogg,vol=50"
  Rescue_Operation  "rescue_operation.ogg,vol=50"
  Army_Of_Rats      "army_of_rats.ogg,vol=50"
  Ritual_Of_The_Forest "ritual_of_the_forest.ogg,vol=50"

  Divine_Meddling   "DivineMed.ogg,vol=60"
  Rage_Of_God       "RageOfGod.ogg"
  Blood_Boil        "BloodBoil.ogg"
  Call_To_Ancient_Spirits "AncientSpirits.ogg,vol=60"
  Golems_Frenzy     "GolemsFrenzy.ogg"
  Golems_Justice    "GolemsJustice.ogg"
  Army_Upgrade      "ArmyUpgrade.ogg"

  Strenghtening     "Strenghtening.ogg,vol=80"
  Healing           "Healing.ogg"
  HealingMini       "HealingMini.ogg,vol=80"
  NegativeEffect    "NegativeEffect.ogg,vol=80"
  PositiveEffect    "PositiveEffect.ogg,vol=80"

$EndOfSection
/** AUTO-GENERATED — do not edit. Run: node scripts/build-recipe-catalog-index.mjs */
export const RECIPE_CATALOG_STATS = {"count":21,"aliases":70,"version":"1.1"};

export const RECIPE_ALIAS_TO_ID = {
  "fish and chips": "fish_and_chips",
  "fish chips": "fish_and_chips",
  "fish supper": "fish_and_chips",
  "fish and chips with mushy peas": "fish_chips_peas",
  "fish chips and peas": "fish_chips_peas",
  "fish supper with peas": "fish_chips_peas",
  "fish chips peas": "fish_chips_peas",
  "beans on toast": "beans_on_toast",
  "beans on two slices of toast": "beans_on_toast",
  "beans on wholemeal toast": "beans_on_toast",
  "bangers and mash": "bangers_mash",
  "bangers mash": "bangers_mash",
  "sausage and mash": "bangers_mash",
  "sunday roast": "sunday_roast",
  "roast dinner": "sunday_roast",
  "roast chicken dinner": "sunday_roast",
  "full english": "full_english",
  "full english breakfast": "full_english",
  "fry up": "full_english",
  "fried breakfast": "full_english",
  "continental breakfast": "continental_breakfast",
  "chole bhature": "chole_bhature",
  "chana bhatura": "chole_bhature",
  "chole bhatura": "chole_bhature",
  "pav bhaji": "pav_bhaji",
  "bhaji pav": "pav_bhaji",
  "chicken tikka masala with rice": "chicken_tikka_rice",
  "chicken tikka masala with basmati rice": "chicken_tikka_rice",
  "chicken tikka and rice": "chicken_tikka_rice",
  "tikka masala with basmati rice": "chicken_tikka_rice",
  "chicken tikka rice": "chicken_tikka_rice",
  "biryani with raita": "biryani_raita",
  "biryani and raita": "biryani_raita",
  "biryani with cucumber raita": "biryani_raita",
  "biryani raita": "biryani_raita",
  "masala dosa plate": "masala_dosa_plate",
  "masala dosa with sambar and chutney": "masala_dosa_plate",
  "dosa with sambar and chutney": "masala_dosa_plate",
  "chapati dal sabzi": "chapati_dal_sabzi",
  "chapatis with dal and sabzi": "chapati_dal_sabzi",
  "roti dal sabzi": "chapati_dal_sabzi",
  "2 chapatis dal and vegetable sabzi": "chapati_dal_sabzi",
  "idli with sambar": "idli_sambar_plate",
  "idlis with sambar and chutney": "idli_sambar_plate",
  "3 idlis with sambar": "idli_sambar_plate",
  "idli sambar plate": "idli_sambar_plate",
  "poha with peanuts": "poha_peanuts",
  "poha peanuts": "poha_peanuts",
  "uttapam with chutney": "uttapam_chutney",
  "uttapam with tomato chutney": "uttapam_chutney",
  "uttapam chutney": "uttapam_chutney",
  "lamb curry with rice": "lamb_curry_rice",
  "lamb curry and rice": "lamb_curry_rice",
  "lamb rogan josh with rice": "lamb_curry_rice",
  "lamb curry rice": "lamb_curry_rice",
  "paneer tikka masala with rice": "paneer_tikka_rice",
  "paneer curry with rice": "paneer_tikka_rice",
  "paneer tikka and rice": "paneer_tikka_rice",
  "paneer tikka rice": "paneer_tikka_rice",
  "dal chawal": "dal_rice",
  "dal rice": "dal_rice",
  "dal with rice": "dal_rice",
  "dal and rice": "dal_rice",
  "chicken korma with rice": "korma_rice",
  "korma and rice": "korma_rice",
  "chicken korma rice": "korma_rice",
  "korma rice": "korma_rice",
  "shepherds pie": "shepherds_pie",
  "shepherd's pie": "shepherds_pie",
  "cottage pie": "shepherds_pie"
};

export const RECIPE_BY_REF_ID = {
  "fish_and_chips": "fish_and_chips",
  "beans_on_toast": "beans_on_toast",
  "bangers_mash": "bangers_mash",
  "roast_dinner": "sunday_roast",
  "full_english": "full_english",
  "continental_breakfast": "continental_breakfast",
  "chole_bhature": "chole_bhature",
  "pav_bhaji": "pav_bhaji",
  "poha": "poha_peanuts"
};

export const RECIPE_BY_ID = {
  "fish_and_chips": {
    "id": "fish_and_chips",
    "dishRefId": "fish_and_chips",
    "kcalRangeMin": 750,
    "kcalRangeMax": 1100,
    "kcalRangeReason": "Chip-shop portion and oil absorption",
    "aliases": [
      "fish and chips",
      "fish & chips",
      "fish supper"
    ],
    "displayName": "Fish and chips",
    "defaultServingGrams": 430,
    "cuisine": "British",
    "sourceScale": {
      "homemade": 1,
      "restaurant": 1.08,
      "takeaway": 1.15
    },
    "cookingFat": {
      "refId": "butter",
      "label": "Frying oil",
      "gramsByOil": {
        "light": 6,
        "normal": 14,
        "generous": 28,
        "deep_fried": 22
      }
    },
    "components": [
      {
        "refId": "white_fish",
        "grams": 180,
        "label": "Battered cod",
        "role": "protein"
      },
      {
        "refId": "fries",
        "grams": 250,
        "label": "Chips",
        "role": "carb"
      }
    ]
  },
  "fish_chips_peas": {
    "id": "fish_chips_peas",
    "aliases": [
      "fish and chips with mushy peas",
      "fish chips and peas",
      "fish supper with peas"
    ],
    "displayName": "Fish and chips with mushy peas",
    "defaultServingGrams": 510,
    "cuisine": "British",
    "sourceScale": {
      "homemade": 1,
      "restaurant": 1.08,
      "takeaway": 1.15
    },
    "cookingFat": {
      "refId": "butter",
      "label": "Frying oil",
      "gramsByOil": {
        "light": 6,
        "normal": 14,
        "generous": 28,
        "deep_fried": 22
      }
    },
    "components": [
      {
        "refId": "white_fish",
        "grams": 180,
        "label": "Battered cod",
        "role": "protein"
      },
      {
        "refId": "fries",
        "grams": 250,
        "label": "Chips",
        "role": "carb"
      },
      {
        "refId": "mushy_peas",
        "grams": 80,
        "label": "Mushy peas",
        "role": "veg"
      }
    ]
  },
  "beans_on_toast": {
    "id": "beans_on_toast",
    "dishRefId": "beans_on_toast",
    "aliases": [
      "beans on toast",
      "beans on two slices of toast",
      "beans on wholemeal toast"
    ],
    "displayName": "Beans on toast",
    "defaultServingGrams": 280,
    "cuisine": "British",
    "cookingFat": {
      "refId": "butter",
      "label": "Butter on toast",
      "gramsByOil": {
        "light": 2,
        "normal": 6,
        "generous": 12,
        "deep_fried": 6
      }
    },
    "components": [
      {
        "refId": "baked_beans",
        "grams": 210,
        "label": "Baked beans",
        "role": "protein"
      },
      {
        "refId": "bread",
        "grams": 70,
        "label": "Toast",
        "role": "carb"
      }
    ]
  },
  "bangers_mash": {
    "id": "bangers_mash",
    "dishRefId": "bangers_mash",
    "aliases": [
      "bangers and mash",
      "bangers mash",
      "sausage and mash"
    ],
    "displayName": "Bangers and mash",
    "defaultServingGrams": 380,
    "cuisine": "British",
    "components": [
      {
        "refId": "sausage",
        "grams": 120,
        "label": "Sausages",
        "role": "protein"
      },
      {
        "refId": "potatoes",
        "grams": 200,
        "label": "Mash",
        "role": "carb"
      },
      {
        "refId": "gravy",
        "grams": 60,
        "label": "Gravy",
        "role": "sauce"
      }
    ]
  },
  "sunday_roast": {
    "id": "sunday_roast",
    "dishRefId": "roast_dinner",
    "aliases": [
      "sunday roast",
      "roast dinner",
      "roast chicken dinner"
    ],
    "displayName": "Sunday roast",
    "defaultServingGrams": 490,
    "cuisine": "British",
    "cookingFat": {
      "refId": "butter",
      "label": "Roasting fat",
      "gramsByOil": {
        "light": 4,
        "normal": 10,
        "generous": 18,
        "deep_fried": 12
      }
    },
    "components": [
      {
        "refId": "roast_chicken",
        "grams": 150,
        "label": "Roast chicken",
        "role": "protein"
      },
      {
        "refId": "potatoes",
        "grams": 150,
        "label": "Roast potatoes",
        "role": "carb"
      },
      {
        "refId": "carrots",
        "grams": 80,
        "label": "Carrots",
        "role": "veg"
      },
      {
        "refId": "peas",
        "grams": 60,
        "label": "Peas",
        "role": "veg"
      },
      {
        "refId": "gravy",
        "grams": 50,
        "label": "Gravy",
        "role": "sauce"
      }
    ]
  },
  "full_english": {
    "id": "full_english",
    "dishRefId": "full_english",
    "aliases": [
      "full english",
      "full english breakfast",
      "fry up",
      "fried breakfast"
    ],
    "displayName": "Full English breakfast",
    "defaultServingGrams": 520,
    "cuisine": "British",
    "cookingFat": {
      "refId": "butter",
      "label": "Frying fat",
      "gramsByOil": {
        "light": 5,
        "normal": 12,
        "generous": 24,
        "deep_fried": 18
      }
    },
    "components": [
      {
        "refId": "boiled_egg",
        "pieces": 2,
        "label": "Eggs",
        "role": "protein"
      },
      {
        "refId": "sausage",
        "grams": 80,
        "label": "Sausages",
        "role": "protein"
      },
      {
        "refId": "baked_beans",
        "grams": 120,
        "label": "Baked beans",
        "role": "carb"
      },
      {
        "refId": "bread",
        "grams": 70,
        "label": "Toast",
        "role": "carb"
      }
    ]
  },
  "continental_breakfast": {
    "id": "continental_breakfast",
    "dishRefId": "continental_breakfast",
    "aliases": [
      "continental breakfast"
    ],
    "displayName": "Continental breakfast",
    "defaultServingGrams": 320,
    "cuisine": "European",
    "components": [
      {
        "refId": "croissant",
        "grams": 60,
        "label": "Croissant",
        "role": "carb"
      },
      {
        "refId": "coffee_black",
        "grams": 200,
        "label": "Coffee",
        "role": "drink"
      },
      {
        "refId": "butter",
        "grams": 10,
        "label": "Butter",
        "role": "fat"
      },
      {
        "refId": "jam",
        "grams": 20,
        "label": "Jam",
        "role": "carb"
      }
    ]
  },
  "chole_bhature": {
    "id": "chole_bhature",
    "dishRefId": "chole_bhature",
    "aliases": [
      "chole bhature",
      "chana bhatura",
      "chole bhatura"
    ],
    "displayName": "Chole bhature",
    "defaultServingGrams": 300,
    "kcalRangeMin": 850,
    "kcalRangeMax": 1100,
    "kcalRangeReason": "Bhature size and oil absorption",
    "cuisine": "Indian",
    "cookingFat": {
      "refId": "butter",
      "label": "Bhatura frying ghee",
      "gramsByOil": {
        "light": 5,
        "normal": 12,
        "generous": 26,
        "deep_fried": 20
      }
    },
    "components": [
      {
        "refId": "chana_masala",
        "grams": 200,
        "label": "Chole",
        "role": "protein"
      },
      {
        "refId": "roti",
        "grams": 100,
        "label": "Bhatura",
        "role": "bread"
      }
    ]
  },
  "pav_bhaji": {
    "id": "pav_bhaji",
    "dishRefId": "pav_bhaji",
    "aliases": [
      "pav bhaji",
      "bhaji pav"
    ],
    "displayName": "Pav bhaji",
    "defaultServingGrams": 330,
    "cuisine": "Indian",
    "components": [
      {
        "refId": "veg_curry",
        "grams": 250,
        "label": "Bhaji",
        "role": "curry"
      },
      {
        "refId": "bread",
        "grams": 80,
        "label": "Pav",
        "role": "bread"
      }
    ]
  },
  "chicken_tikka_rice": {
    "id": "chicken_tikka_rice",
    "aliases": [
      "chicken tikka masala with rice",
      "chicken tikka masala with basmati rice",
      "chicken tikka and rice",
      "tikka masala with basmati rice"
    ],
    "displayName": "Chicken tikka masala with rice",
    "defaultServingGrams": 430,
    "cuisine": "Indian",
    "components": [
      {
        "refId": "chicken_tikka_masala",
        "grams": 250,
        "label": "Chicken tikka masala",
        "role": "curry"
      },
      {
        "refId": "basmati_rice",
        "grams": 180,
        "label": "Basmati rice",
        "role": "carb"
      }
    ]
  },
  "biryani_raita": {
    "id": "biryani_raita",
    "aliases": [
      "biryani with raita",
      "biryani and raita",
      "biryani with cucumber raita"
    ],
    "displayName": "Biryani with raita",
    "defaultServingGrams": 430,
    "kcalRangeMin": 650,
    "kcalRangeMax": 950,
    "kcalRangeReason": "Restaurant biryani portion and oil",
    "cuisine": "Indian",
    "components": [
      {
        "refId": "biryani",
        "grams": 350,
        "label": "Biryani",
        "role": "main"
      },
      {
        "refId": "raita",
        "grams": 80,
        "label": "Cucumber raita",
        "role": "side"
      }
    ]
  },
  "masala_dosa_plate": {
    "id": "masala_dosa_plate",
    "aliases": [
      "masala dosa plate",
      "masala dosa with sambar and chutney",
      "dosa with sambar and chutney"
    ],
    "displayName": "Masala dosa plate",
    "defaultServingGrams": 400,
    "cuisine": "Indian",
    "cookingFat": {
      "refId": "butter",
      "label": "Dosa griddle oil",
      "gramsByOil": {
        "light": 3,
        "normal": 8,
        "generous": 16,
        "deep_fried": 10
      }
    },
    "components": [
      {
        "refId": "dosa",
        "grams": 170,
        "label": "Masala dosa",
        "role": "main"
      },
      {
        "refId": "sambar",
        "grams": 200,
        "label": "Sambar",
        "role": "side"
      },
      {
        "refId": "coconut_chutney",
        "grams": 30,
        "label": "Coconut chutney",
        "role": "side"
      }
    ]
  },
  "chapati_dal_sabzi": {
    "id": "chapati_dal_sabzi",
    "aliases": [
      "chapati dal sabzi",
      "chapatis with dal and sabzi",
      "roti dal sabzi",
      "2 chapatis dal and vegetable sabzi"
    ],
    "displayName": "Chapati, dal and sabzi",
    "defaultServingGrams": 470,
    "cuisine": "Indian",
    "components": [
      {
        "refId": "roti",
        "pieces": 2,
        "label": "Chapatis",
        "role": "bread"
      },
      {
        "refId": "dal",
        "grams": 200,
        "label": "Dal tadka",
        "role": "protein"
      },
      {
        "refId": "veg_curry",
        "grams": 150,
        "label": "Vegetable sabzi",
        "role": "veg"
      }
    ]
  },
  "idli_sambar_plate": {
    "id": "idli_sambar_plate",
    "aliases": [
      "idli with sambar",
      "idlis with sambar and chutney",
      "3 idlis with sambar"
    ],
    "displayName": "Idli with sambar",
    "defaultServingGrams": 380,
    "cuisine": "Indian",
    "components": [
      {
        "refId": "idli",
        "pieces": 3,
        "label": "Idlis",
        "role": "main"
      },
      {
        "refId": "sambar",
        "grams": 200,
        "label": "Sambar",
        "role": "side"
      },
      {
        "refId": "coconut_chutney",
        "grams": 30,
        "label": "Coconut chutney",
        "role": "side",
        "optional": true
      }
    ]
  },
  "poha_peanuts": {
    "id": "poha_peanuts",
    "dishRefId": "poha",
    "aliases": [
      "poha with peanuts",
      "poha peanuts"
    ],
    "displayName": "Poha with peanuts",
    "defaultServingGrams": 250,
    "cuisine": "Indian",
    "cookingFat": {
      "refId": "butter",
      "label": "Tempering oil",
      "gramsByOil": {
        "light": 3,
        "normal": 8,
        "generous": 16,
        "deep_fried": 10
      }
    },
    "components": [
      {
        "refId": "poha",
        "grams": 200,
        "label": "Poha",
        "role": "main"
      },
      {
        "refId": "nuts",
        "grams": 25,
        "label": "Peanuts",
        "role": "topping"
      }
    ]
  },
  "uttapam_chutney": {
    "id": "uttapam_chutney",
    "aliases": [
      "uttapam with chutney",
      "uttapam with tomato chutney"
    ],
    "displayName": "Uttapam with chutney",
    "defaultServingGrams": 220,
    "cuisine": "Indian",
    "cookingFat": {
      "refId": "butter",
      "label": "Griddle oil",
      "gramsByOil": {
        "light": 3,
        "normal": 8,
        "generous": 16,
        "deep_fried": 10
      }
    },
    "components": [
      {
        "refId": "uttapam",
        "grams": 180,
        "label": "Uttapam",
        "role": "main"
      },
      {
        "refId": "coconut_chutney",
        "grams": 30,
        "label": "Chutney",
        "role": "side"
      }
    ]
  },
  "lamb_curry_rice": {
    "id": "lamb_curry_rice",
    "aliases": [
      "lamb curry with rice",
      "lamb curry and rice",
      "lamb rogan josh with rice"
    ],
    "displayName": "Lamb curry with rice",
    "defaultServingGrams": 420,
    "cuisine": "Indian",
    "components": [
      {
        "refId": "lamb_curry",
        "grams": 240,
        "label": "Lamb curry",
        "role": "curry"
      },
      {
        "refId": "basmati_rice",
        "grams": 180,
        "label": "Basmati rice",
        "role": "carb"
      }
    ]
  },
  "paneer_tikka_rice": {
    "id": "paneer_tikka_rice",
    "aliases": [
      "paneer tikka masala with rice",
      "paneer curry with rice",
      "paneer tikka and rice"
    ],
    "displayName": "Paneer tikka masala with rice",
    "defaultServingGrams": 410,
    "cuisine": "Indian",
    "components": [
      {
        "refId": "paneer_tikka",
        "grams": 230,
        "label": "Paneer tikka masala",
        "role": "curry"
      },
      {
        "refId": "basmati_rice",
        "grams": 180,
        "label": "Basmati rice",
        "role": "carb"
      }
    ]
  },
  "dal_rice": {
    "id": "dal_rice",
    "aliases": [
      "dal chawal",
      "dal rice",
      "dal with rice",
      "dal and rice"
    ],
    "displayName": "Dal with rice",
    "defaultServingGrams": 380,
    "cuisine": "Indian",
    "components": [
      {
        "refId": "dal",
        "grams": 200,
        "label": "Dal tadka",
        "role": "protein"
      },
      {
        "refId": "basmati_rice",
        "grams": 180,
        "label": "Basmati rice",
        "role": "carb"
      }
    ]
  },
  "korma_rice": {
    "id": "korma_rice",
    "aliases": [
      "chicken korma with rice",
      "korma and rice",
      "chicken korma rice"
    ],
    "displayName": "Chicken korma with rice",
    "defaultServingGrams": 430,
    "cuisine": "Indian",
    "cookingFat": {
      "refId": "butter",
      "label": "Korma cream & oil",
      "gramsByOil": {
        "light": 5,
        "normal": 14,
        "generous": 28,
        "deep_fried": 16
      }
    },
    "components": [
      {
        "refId": "chicken_korma",
        "grams": 250,
        "label": "Chicken korma",
        "role": "curry"
      },
      {
        "refId": "basmati_rice",
        "grams": 180,
        "label": "Basmati rice",
        "role": "carb"
      }
    ]
  },
  "shepherds_pie": {
    "id": "shepherds_pie",
    "aliases": [
      "shepherds pie",
      "shepherd's pie",
      "cottage pie"
    ],
    "displayName": "Shepherd's pie",
    "defaultServingGrams": 400,
    "cuisine": "British",
    "components": [
      {
        "refId": "beef",
        "grams": 200,
        "label": "Minced lamb",
        "role": "protein"
      },
      {
        "refId": "potatoes",
        "grams": 200,
        "label": "Mash topping",
        "role": "carb"
      }
    ]
  }
};

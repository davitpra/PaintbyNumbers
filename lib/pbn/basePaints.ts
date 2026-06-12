import { RGB } from "./common";

export interface BasePaint {
  id: string;
  nameEs: string;
  nameEn: string;
  rgb: RGB;
  /** Product/reference code for buying in store (e.g. "410") */
  codigo: string;
  /** Colour Index pigment(s), e.g. "PY74" */
  pigmento: string;
}

// Set of 12 common, store-buyable artist acrylics (with product code & pigment index).
export const DEFAULT_BASE_PAINTS: BasePaint[] = [
  { id: "primary-yellow",        nameEs: "Amarillo Primario",          nameEn: "Primary Yellow",                 codigo: "410", pigmento: "PY74",         rgb: [255, 216, 0]   },
  { id: "cadmium-orange-hue",    nameEs: "Naranja de Cadmio (tono)",   nameEn: "Cadmium Orange Hue",             codigo: "720", pigmento: "PO73",         rgb: [242, 124, 22]  },
  { id: "alizarin-crimson-hue",  nameEs: "Carmesí de Alizarina (tono)", nameEn: "Alizarin Crimson Hue Permanent", codigo: "116", pigmento: "PR206, PR202", rgb: [138, 22, 40]   },
  { id: "primary-red",           nameEs: "Rojo Primario",              nameEn: "Primary Red",                    codigo: "415", pigmento: "PV19",         rgb: [222, 32, 55]   },
  { id: "dioxazine-purple",      nameEs: "Púrpura de Dioxazina",       nameEn: "Dioxazine Purple",               codigo: "186", pigmento: "PV23 RS",      rgb: [58, 22, 80]    },
  { id: "primary-blue",          nameEs: "Azul Primario",              nameEn: "Primary Blue",                   codigo: "420", pigmento: "PB15:3",       rgb: [16, 52, 156]   },
  { id: "phthalocyanine-green",  nameEs: "Verde Ftalocianina",         nameEn: "Phthalocyanine Green",           codigo: "317", pigmento: "PG7",          rgb: [0, 78, 72]     },
  { id: "light-green-permanent", nameEs: "Verde Claro Permanente",     nameEn: "Light Green Permanent",          codigo: "312", pigmento: "PG7, PY74, PW6", rgb: [64, 168, 52]  },
  { id: "burnt-sienna",          nameEs: "Siena Tostado",              nameEn: "Burnt Sienna",                   codigo: "127", pigmento: "PBk9, PR101",  rgb: [128, 48, 24]   },
  { id: "burnt-umber",           nameEs: "Sombra Tostada",             nameEn: "Burnt Umber",                    codigo: "128", pigmento: "PBr7",         rgb: [58, 40, 28]    },
  { id: "titanium-white",        nameEs: "Blanco de Titanio",          nameEn: "Titanium White",                 codigo: "432", pigmento: "PW6",          rgb: [248, 248, 246] },
  { id: "mars-black",            nameEs: "Negro Marte",                nameEn: "Mars Black",                     codigo: "276", pigmento: "PBk11",        rgb: [26, 26, 26]    },
];

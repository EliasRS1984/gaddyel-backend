import dotenv from "dotenv";
import mongoose from "mongoose";
import { Producto } from "./src/models/Product.js";

dotenv.config();

const productos = [
  {
    nombre: "Set Toallas para Manos Premium",
    descripcion: "Suavidad y absorción para tus clientes, ideal para spas y centros de estética.",
    descripcionCompleta: "Nuestro set de toallas premium está confeccionado con 100% algodón de alta calidad. Ofrece una suavidad inigualable y una absorción superior, ideal para el uso profesional en spas, salones de belleza y centros de estética. Son duraderas, de fácil lavado y mantienen su textura después de múltiples ciclos de uso.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552185/gaddyel_catalogo/d8tvmj9iex7kyrc0se2g.jpg",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552185/gaddyel_catalogo/d8tvmj9iex7kyrc0se2g.jpg", alt: "Set de Toallas Premium" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552186/gaddyel_catalogo/gsqcjsnmcfflpdupaias.jpg", alt: "Toalla" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552187/gaddyel_catalogo/sghgpfuhxdy9dgj4ojbp.jpg", alt: "Toalla" }
    ],
    destacado: false,
    categoria: "Blanquería para Estética",
    material: "100% Algodón",
    tamanos: ["(40x30cm)"],
    colores: ["Blanco"],
    personalizable: true,
    precio: 68000,
    cantidadUnidades: 12
  },
  {
    nombre: "Batas Beauty",
    descripcion: "El toque de lujo y exclusividad para tu establecimiento.",
    descripcionCompleta: "Estas batas de satén no solo son elegantes, sino que también son increíblemente cómodas. Pueden ser personalizadas con el logo de tu establecimiento.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552168/gaddyel_catalogo/wbjwuwdsgq2gaotmcnie.jpg",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552168/gaddyel_catalogo/wbjwuwdsgq2gaotmcnie.jpg", alt: "Batas Personalizadas" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552169/gaddyel_catalogo/zy4qzkqrcb5vcyf1ortk.jpg", alt: "Batas Personalizadas" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552167/gaddyel_catalogo/fsz2unuwq3vg0u6obuqi.jpg", alt: "Batas de satén en uso" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552166/gaddyel_catalogo/pv6xpcpsaxboolmjsybt.jpg", alt: "Batas Personalizadas" }
    ],
    destacado: true,
    categoria: "Blanquería para Estética",
    material: "Satén de seda",
    tamanos: ["standard", "Especial"],
    colores: ["Blanco", "Negro", "Marfil", "Champagne"],
    personalizable: true,
    precio: 87000,
    cantidadUnidades: 2
  },
  {
    nombre: "Vinchas para Tratamientos Faciales",
    descripcion: "Comodidad y estilo para cada sesión de belleza.",
    descripcionCompleta: "Fabricadas con plush suave e hipoalergénica, estas vinchas están diseñadas para mantener el cabello alejado del rostro.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552210/gaddyel_catalogo/vlaiyxfhnqgpczrdr9zd.jpg",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552210/gaddyel_catalogo/vlaiyxfhnqgpczrdr9zd.jpg", alt: "Vinchas para Tratamientos Faciales" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552208/gaddyel_catalogo/svc35zgbl3j71t6tt0mf.jpg", alt: "Vinchas" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552206/gaddyel_catalogo/u9mhxbaraqbtcuckvior.jpg", alt: "Vinchas" }
    ],
    destacado: false,
    categoria: "Blanquería para Estética",
    material: "Plush",
    tamanos: ["Único"],
    colores: ["Blanco", "Negro", "Verde Inglés"],
    personalizable: true,
    precio: 66000,
    cantidadUnidades: 12
  },
  {
    nombre: "Pads",
    descripcion: "Pads de limpieza facial, perfectos para tus clientes.",
    descripcionCompleta: "Nuestros pads de limpieza facial reutilizables son la alternativa sostenible a los discos de algodón desechables.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552176/gaddyel_catalogo/xwlp6jcczkbdymdoe6i6.jpg",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552176/gaddyel_catalogo/xwlp6jcczkbdymdoe6i6.jpg", alt: "Pads de limpieza facial" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552175/gaddyel_catalogo/fihgfgnpmdie3vhgm2yh.jpg", alt: "Paquetes de pads" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552174/gaddyel_catalogo/q32irdfxwbmbxqedt9kz.jpg", alt: "Paquetes de pads" }
    ],
    destacado: false,
    categoria: "Blanquería para Estética",
    material: "plush y toalla",
    tamanos: ["Único"],
    colores: ["Varios"],
    personalizable: false,
    precio: 36000,
    cantidadUnidades: 12
  },
  {
    nombre: "Kit de Limpieza Facial",
    descripcion: "Kit de limpieza facial. Material hipoalergénico.",
    descripcionCompleta: "El kit de limpieza facial es un conjunto completo para un cuidado de la piel profundo.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552172/gaddyel_catalogo/j4tw0i1rjogksrfm8bp0.jpg",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552172/gaddyel_catalogo/j4tw0i1rjogksrfm8bp0.jpg", alt: "Kit de Limpieza Facial" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552171/gaddyel_catalogo/k57qfawq8qcbmegs1kle.jpg", alt: "Productos del kit" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552171/gaddyel_catalogo/xxzmfg75dx0zbhuedlpt.jpg", alt: "Productos del kit" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552169/gaddyel_catalogo/z8otetyghlz6jyq10zvz.jpg", alt: "Productos del kit" }
    ],
    destacado: true,
    categoria: "Blanquería para Estética",
    material: "Varios",
    tamanos: ["Único"],
    colores: ["Varios"],
    personalizable: true,
    precio: 103000,
    cantidadUnidades: 24
  },
  {
    nombre: "Pareos",
    descripcion: "Pareos caricias sin fin. Material hipoalergénico.",
    descripcionCompleta: "Pareos caricias sin fin para tratamientos corporales. suaves y ergonómicos.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552181/gaddyel_catalogo/xs4kmxvgxxdlyy0ezjoe.png",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552181/gaddyel_catalogo/xs4kmxvgxxdlyy0ezjoe.png", alt: "Pareos" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552179/gaddyel_catalogo/h8fmkla6f3uzkzayj1lg.jpg", alt: "Pareos" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552178/gaddyel_catalogo/q21dkts6mxnwzhwx2xub.jpg", alt: "Pareos" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552177/gaddyel_catalogo/peombeton2dvqccx2njb.jpg", alt: "Pareos" }
    ],
    destacado: true,
    categoria: "Blanquería para Estética",
    material: "plush",
    tamanos: ["Único"],
    colores: ["Negro", "Blanco", "Verde Inglés", "Rosa", "Natural"],
    personalizable: true,
    precio: 56000,
    cantidadUnidades: 2
  },
  {
    nombre: "Conjunto para Camilla",
    descripcion: "Sábana más Funda de Almohada.",
    descripcionCompleta: "Diseñados para un entorno profesional y de confort.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552183/gaddyel_catalogo/hgul1ulgewapzss9n9gk.jpg",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552183/gaddyel_catalogo/hgul1ulgewapzss9n9gk.jpg", alt: "Conjunto para Camilla" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552184/gaddyel_catalogo/qimvjq8ismo8k9qmduld.jpg", alt: "conjunto para camilla" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552182/gaddyel_catalogo/zjalbfpagjjdgnwxhwju.jpg", alt: "conjunto para camilla" }
    ],
    destacado: false,
    categoria: "Blanquería para Estética",
    material: "Microfibra",
    tamanos: ["2x1.20m", "2.40x1.20m"],
    colores: ["Blanco"],
    personalizable: true,
    precio: 26000,
    cantidadUnidades: 1
  },
  {
    nombre: "Turbantes",
    descripcion: "Toalla Turbante.",
    descripcionCompleta: "Envuelve delicadamente el cabello, reduciendo el tiempo de secado y minimizando el frizz.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552206/gaddyel_catalogo/vjhyxybx4nufyigymuvu.jpg",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552206/gaddyel_catalogo/vjhyxybx4nufyigymuvu.jpg", alt: "Toalla Turbante" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552203/gaddyel_catalogo/oawgob2ebuq85ym66dwg.jpg", alt: "Toalla Turbante" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552204/gaddyel_catalogo/nkiszvqjbvbmbnu5tmqj.jpg", alt: "Toalla Turbante" }
    ],
    destacado: false,
    categoria: "Blanquería para Estética",
    material: "100% algodón",
    tamanos: ["Único"],
    colores: ["Varios"],
    personalizable: true,
    precio: 60000,
    cantidadUnidades: 4
  },
  {
    nombre: "Batas Caricias sin fin",
    descripcion: "Batas Caricias Sin Fin. Donde el bienestar se siente, y el lujo se vive.",
    descripcionCompleta: "Diseñadas para ofrecer una sensación de calidez y ligereza.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552165/gaddyel_catalogo/pbl2ajwsfo5kdh477ca1.jpg",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552165/gaddyel_catalogo/pbl2ajwsfo5kdh477ca1.jpg", alt: "Batas Caricias sin fin" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552166/gaddyel_catalogo/f7wdrddxuwweknfc6svv.jpg", alt: "Batas Caricias sin fin" }
    ],
    destacado: false,
    categoria: "Blanquería para Estética",
    material: "plush",
    tamanos: ["Único"],
    colores: ["Blanco"],
    personalizable: true,
    precio: 90000,
    cantidadUnidades: 2
  },
  {
    nombre: "Tote Bag Playera",
    descripcion: "Descubre el equilibrio perfecto entre estilo, resistencia y funcionalidad.",
    descripcionCompleta: "Confeccionado en lienzo premium de alta durabilidad.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552192/gaddyel_catalogo/ra0abthkbworwmwam3vl.jpg",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552192/gaddyel_catalogo/ra0abthkbworwmwam3vl.jpg", alt: "Tote Bag Playera" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552202/gaddyel_catalogo/ieopzvbjmzgsipflogp0.jpg", alt: "Tote Bag Playera" }
    ],
    destacado: false,
    categoria: "Blanquería para Estética",
    material: "Lienzo Premium",
    tamanos: ["Único"],
    colores: ["Natural"],
    personalizable: true,
    precio: 17000,
    cantidadUnidades: 1
  },
  {
    nombre: "Neceser",
    descripcion: "Eleva tu rutina de belleza con nuestro Neceser Porta Cosméticos.",
    descripcionCompleta: "Confeccionado en material Nido de Abeja (Waffle) de alta calidad, elegancia natural.",
    imagenSrc: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552173/gaddyel_catalogo/ewmap2v4a18yziu6uvp2.png",
    imagenes: [
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552173/gaddyel_catalogo/ewmap2v4a18yziu6uvp2.png", alt: "Neceser Porta Cosméticos" },
      { src: "https://res.cloudinary.com/dyv5lk3ct/image/upload/v1762552173/gaddyel_catalogo/dji55mhk9r88rd3z19m1.jpg", alt: "Neceser Porta Cosméticos" }
    ],
    destacado: false,
    categoria: "Blanquería para Estética",
    material: "Nido de Abeja",
    tamanos: ["Único"],
    colores: ["Blanco"],
    personalizable: true,
    precio: 8000,
    cantidadUnidades: 1
  }
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Conectado a MongoDB");

    // Insertamos los productos (si querés evitar duplicados, primero borrar)
    await Producto.insertMany(productos);
    console.log("Productos importados correctamente:", productos.length);

    await mongoose.disconnect();
    console.log("Desconectado. Fin.");
    process.exit(0);
  } catch (err) {
    console.error("Error al importar productos:", err);
    process.exit(1);
  }
};

run();

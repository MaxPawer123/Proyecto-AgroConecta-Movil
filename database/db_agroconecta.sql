-- =========================================================
-- SCRIPT DE BASE DE DATOS - AGROCONECTA (VERSIÓN FINAL MVP)
-- =========================================================

-- 1. LIMPIEZA INICIAL (Borrón y Cuenta Nueva)
-- CUIDADO: Esto borrará los datos anteriores para crear la estructura limpia.
DROP TABLE IF EXISTS gasto_lote CASCADE;
DROP TABLE IF EXISTS lote CASCADE;
DROP TABLE IF EXISTS producto CASCADE;
DROP TABLE IF EXISTS productor CASCADE;
DROP TABLE IF EXISTS usuario CASCADE;

-- =========================================================
-- 2. CREACIÓN DE TABLAS MAESTRAS
-- =========================================================

CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('productor', 'cliente', 'admin')),
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
    correo VARCHAR(150) UNIQUE, -- Útil para clientes web
    telefono VARCHAR(20) UNIQUE NOT NULL, -- Útil para contactar a cualquier usuario
    contrasena VARCHAR(255), -- Hash de la contraseña (para clientes web)
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla Secundaria: PRODUCTOR (Extensión exclusiva para usuarios con rol 'productor')
CREATE TABLE productor (
    id_productor SERIAL PRIMARY KEY,
    id_usuario INTEGER UNIQUE NOT NULL, -- El UNIQUE garantiza que sea una relación 1 a 1
    pin VARCHAR(255), -- Hash del PIN de 4 dígitos (para la app móvil)
    departamento VARCHAR(50) NOT NULL,
    municipio VARCHAR(100) NOT NULL,
    comunidad VARCHAR(150) NOT NULL,
    
    -- Llave foránea que conecta al productor con su cuenta de usuario
    CONSTRAINT fk_usuario
        FOREIGN KEY (id_usuario) 
        REFERENCES usuario(id_usuario) 
        ON DELETE CASCADE -- Si borras   al usuario, se borra su perfil de productor automáticamente
);

-- Índices para que el backend busque rapidísimo cuando se inicie sesión
CREATE INDEX idx_usuarios_correo ON usuario(correo);
CREATE INDEX idx_usuarios_telefono ON usuario(telefono);
CREATE INDEX idx_productores_usuario ON productor(id_usuario);

-- Tabla de Productores (Extensión del usuario)
CREATE TABLE IF NOT EXISTS productor (
    id_productor SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    comunidad VARCHAR(100) NOT NULL, -- Ej: Milla Milla
    municipio VARCHAR(100) NOT NULL, -- Ej: Sica Sica
);


-- Tabla de Productos (Catálogo General)
CREATE TABLE producto (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL, -- Ej: Quinua Real
    categoria VARCHAR(50) CHECK (categoria IN ('Grano', 'Tuberculo', 'Hortaliza', 'Forraje')),
    unidad_medida_base VARCHAR(20) DEFAULT 'Kg'
);

-- =========================================================
-- 3. CREACIÓN DE TABLAS DEL NÚCLEO (CORE)
-- =========================================================

-- Tabla de Lotes (Gestión de la Producción)
CREATE TABLE lote (
    id_lote SERIAL PRIMARY KEY,
    id_productor INT NOT NULL REFERENCES productor(id_productor),
    id_producto INT NOT NULL REFERENCES producto(id_producto),
    
    -- Identificación
    nombre_lote VARCHAR(100) NOT NULL, -- Ej: "Campaña Quinua 2026"
    superficie NUMERIC(10,2) NOT NULL, -- En Hectáreas
    
    -- Fechas
    fecha_siembra DATE NOT NULL,
    fecha_cosecha_est DATE NOT NULL, -- Fecha estimada
    
    -- Proyecciones Financieras (Al inicio)
    rendimiento_estimado NUMERIC(10,2) NOT NULL, -- Kg esperados
    precio_venta_est NUMERIC(10,2) NOT NULL,     -- Bs por Kg esperado
    
    -- Resultados Reales (Al final - Para el cierre)
    rendimiento_real NUMERIC(10,2), -- Kg que realmente sacó (Dato del Modal de Cierre)
    
    -- FOTOS Y EVIDENCIAS (Lo que añadimos hoy)
    foto_siembra_url VARCHAR(255),  -- Opcional (Inicio)
    foto_cosecha_url VARCHAR(255),  -- Requerida al cerrar (Para vender)
    
    -- Estado del Ciclo
    estado VARCHAR(20) CHECK (estado IN ('ACTIVO', 'COSECHADO', 'VENDIDO', 'CANCELADO')) DEFAULT 'ACTIVO',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Gastos (Calculadora de Costos)
CREATE TABLE gasto_lote (
    id_gasto SERIAL PRIMARY KEY,
    id_lote INT NOT NULL REFERENCES lote(id_lote) ON DELETE CASCADE,
    
    categoria VARCHAR(50) NOT NULL, -- Semillas, Fertilizantes, Alquiler, Mano de Obra
    descripcion VARCHAR(200),
    
    -- Datos Económicos
    cantidad NUMERIC(10,2) DEFAULT 1,
    costo_unitario NUMERIC(10,2) NOT NULL,
    monto_total NUMERIC(10,2) NOT NULL, -- Se calcula: cantidad * costo_unitario
    
    tipo_costo VARCHAR(20) CHECK (tipo_costo IN ('FIJO', 'VARIABLE')),
    modalidad_pago VARCHAR(20) CHECK (modalidad_pago IN ('CICLO', 'ANUAL', 'NA')) DEFAULT 'NA',
    
    fecha_gasto DATE DEFAULT CURRENT_DATE
);
CREATE TABLE produccion_lote (
    id_produccion SERIAL PRIMARY KEY,
     id_lote INT NOT NULL REFERENCES lote(id_lote),
    fecha_registro DATE NOT NULL,
    
    -- DECIMAL(10,2) significa: hasta 10 dígitos en total, con 2 decimales. 
    -- Ideal para kilos (ej. 1500.50) y dinero (ej. 350.00)
    cantidad_obtenida DECIMAL(10, 2) NOT NULL,
    precio_venta DECIMAL(10, 2) NOT NULL,
    
    -- Control para tu arquitectura Offline-First
    estado_sincronizacion VARCHAR(20) DEFAULT 'SINCRONIZADO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);




-- =========================================================
-- 4. DATOS SEMILLA (SEEDERS) PARA PRUEBAS
-- =========================================================

-- 1. Usuarios (Password '123456' encriptado con Bcrypt para pruebas rápidas)
-- NOTA: En producción usarás el endpoint de registro, esto es solo para no empezar vacío.
INSERT INTO usuario (nombre_completo, email, password_hash, rol) VALUES 
('Juan Mamani', 'juan@agro.com', '$2a$10$XyZ...', 'PRODUCTOR'), -- Productor
('Admin Sistema', 'admin@agro.com', '$2a$10$XyZ...', 'ADMIN');

-- 2. Perfil Productor
INSERT INTO productor (id_usuario, comunidad, municipio, telefono) VALUES 
(1, 'Milla Milla', 'Sica Sica', '77712345');

-- 3. Catálogo de Productos
INSERT INTO producto (nombre, categoria) VALUES 
('Quinua Real', 'Grano'),
('Papa Imilla', 'Tuberculo'),
('Haba', 'Hortaliza');

-- 4. Lote ACTIVO (Ejemplo de uno que apenas está empezando)
INSERT INTO lote (id_productor, id_producto, nombre_lote, superficie, fecha_siembra, fecha_cosecha_est, rendimiento_estimado, precio_venta_est, estado, foto_siembra_url)
VALUES 
(1, 1, 'Lote Norte - Quinua 2026', 2.0, '2025-10-15', '2026-04-01', 800.00, 15.00, 'ACTIVO', 'https://via.placeholder.com/300?text=Foto+Terreno');

-- 5. Lote COSECHADO (Ejemplo de uno ya cerrado listo para vender)
INSERT INTO lote (id_productor, id_producto, nombre_lote, superficie, fecha_siembra, fecha_cosecha_est, fecha_cierre_real, rendimiento_estimado, precio_venta_est, rendimiento_real, estado, foto_cosecha_url)
VALUES 
(1, 2, 'Lote Sur - Papa 2025', 1.5, '2025-08-01', '2026-01-15', '2026-01-20', 1500.00, 40.00, 1450.00, 'COSECHADO', 'https://via.placeholder.com/300?text=Papa+Cosechada');

-- 6. Gastos de prueba
INSERT INTO gasto_lote (id_lote, categoria, descripcion, cantidad, costo_unitario, monto_total, tipo_costo) VALUES 
(1, 'Semillas', 'Semilla Certificada', 2, 200, 400, 'VARIABLE'),
(1, 'Mano de Obra', 'Jornal Siembra', 3, 100, 300, 'VARIABLE'),
(2, 'Fertilizante', 'Abono Orgánico', 5, 50, 250, 'VARIABLE');
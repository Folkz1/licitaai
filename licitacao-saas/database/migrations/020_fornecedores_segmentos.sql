-- Migration 020: Supplier/Segment SEO pages
-- Creates segmentos table for organizing licitacoes by business segment

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS segmentos (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  keywords TEXT[] NOT NULL,
  icone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO segmentos (slug, nome, descricao, keywords, icone) VALUES
('papel-celulose', 'Papel e Celulose', 'Papel A4, sulfite, celulose, papelaria', ARRAY['papel', 'sulfite', 'celulose', 'papelaria', 'resma'], 'file-text'),
('tecnologia-informacao', 'Tecnologia da Informação', 'Computadores, servidores, software, suporte técnico', ARRAY['informática', 'computador', 'servidor', 'software', 'notebook', 'microcomputador'], 'monitor'),
('material-hospitalar', 'Material Hospitalar', 'Equipamentos médicos, insumos hospitalares', ARRAY['hospitalar', 'médico', 'cirúrgico', 'insumo hospitalar', 'EPIs', 'luva', 'seringa'], 'heart-pulse'),
('medicamentos', 'Medicamentos', 'Medicamentos e insumos farmacêuticos', ARRAY['medicamento', 'fármaco', 'vacina', 'farmacêutico'], 'pill'),
('alimentos', 'Alimentos e Merenda', 'Gêneros alimentícios e merenda escolar', ARRAY['alimento', 'merenda', 'alimentação', 'gênero alimentício', 'refeição', 'cesta básica'], 'utensils'),
('limpeza-higiene', 'Limpeza e Higiene', 'Produtos de limpeza e material de higiene', ARRAY['limpeza', 'higiene', 'desinfetante', 'detergente', 'papel higiênico'], 'sparkles'),
('construcao-civil', 'Construção Civil', 'Material de construção e obras de engenharia', ARRAY['construção', 'obra', 'cimento', 'concreto', 'pavimentação', 'reforma'], 'building-2'),
('combustivel', 'Combustíveis', 'Gasolina, diesel, etanol, lubrificantes', ARRAY['combustível', 'gasolina', 'diesel', 'etanol', 'lubrificante', 'abastecimento'], 'fuel'),
('veiculos', 'Veículos e Autopeças', 'Veículos, peças automotivas, pneus', ARRAY['veículo', 'automóvel', 'pneu', 'autopeça', 'caminhão', 'ambulância'], 'car'),
('uniformes', 'Uniformes e Vestuário', 'Uniformes, fardamento, calçados', ARRAY['uniforme', 'fardamento', 'vestuário', 'calçado', 'bota', 'jaleco'], 'shirt'),
('mobiliario', 'Mobiliário', 'Móveis, cadeiras, mesas, mobiliário escolar', ARRAY['móvel', 'mobiliário', 'cadeira', 'mesa', 'estante', 'armário'], 'armchair'),
('material-eletrico', 'Material Elétrico', 'Fios, cabos, lâmpadas, iluminação', ARRAY['elétrico', 'lâmpada', 'luminária', 'fio', 'cabo elétrico', 'LED', 'iluminação'], 'zap'),
('seguranca', 'Segurança', 'Vigilância, monitoramento, alarmes', ARRAY['segurança', 'vigilância', 'monitoramento', 'alarme', 'CFTV', 'câmera'], 'shield'),
('engenharia', 'Serviços de Engenharia', 'Projetos, fiscalização, laudos técnicos', ARRAY['engenharia', 'projeto', 'fiscalização', 'laudo técnico'], 'hard-hat'),
('telecomunicacoes', 'Telecomunicações', 'Telefonia, internet, fibra óptica', ARRAY['telecomunicação', 'telefonia', 'internet', 'fibra óptica', 'banda larga'], 'wifi'),
('grafica', 'Gráfica e Impressão', 'Material gráfico, banners, sinalização', ARRAY['gráfica', 'impressão', 'banner', 'sinalização', 'folder'], 'printer'),
('transporte', 'Transporte e Frete', 'Transporte de cargas, logística', ARRAY['transporte', 'frete', 'logística', 'carga', 'mudança'], 'truck'),
('equipamentos', 'Equipamentos Industriais', 'Máquinas, ferramentas, equipamentos pesados', ARRAY['equipamento', 'máquina', 'ferramenta', 'compressor', 'gerador'], 'wrench'),
('material-expediente', 'Material de Expediente', 'Material de escritório e papelaria', ARRAY['expediente', 'escritório', 'caneta', 'grampeador', 'material de expediente'], 'clipboard'),
('agua-saneamento', 'Água e Saneamento', 'Tratamento de água, esgoto, tubulação', ARRAY['água', 'saneamento', 'esgoto', 'tubulação'], 'droplets'),
('ar-condicionado', 'Climatização', 'Ar condicionado e refrigeração', ARRAY['ar condicionado', 'climatização', 'refrigeração', 'split'], 'thermometer'),
('educacao', 'Material Educacional', 'Livros didáticos e material pedagógico', ARRAY['educação', 'didático', 'pedagógico', 'escolar', 'livro', 'apostila'], 'book-open'),
('laboratorio', 'Laboratório', 'Reagentes, vidraria, equipamentos de laboratório', ARRAY['laboratório', 'reagente', 'vidraria', 'análise', 'microscópio'], 'flask-conical'),
('odontologico', 'Material Odontológico', 'Equipamentos e materiais odontológicos', ARRAY['odontológico', 'dentário', 'dental', 'odontologia'], 'smile'),
('agropecuaria', 'Agropecuária', 'Insumos agrícolas, sementes, fertilizantes', ARRAY['agrícola', 'agropecuária', 'semente', 'adubo', 'fertilizante', 'defensivo'], 'wheat')
ON CONFLICT (slug) DO NOTHING;

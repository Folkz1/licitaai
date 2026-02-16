-- Migration: 007_pg_cron_setup.sql
-- Configura pg_cron para executar busca/análise automaticamente

-- 1. Criar tabela de jobs pendentes do cron
CREATE TABLE IF NOT EXISTS cron_jobs_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow TEXT NOT NULL CHECK (workflow IN ('BUSCA_PNCP', 'ANALISE_EDITAIS')),
  execution_id UUID,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  params JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_queue_status ON cron_jobs_queue(status);

-- 2. Função que agenda jobs na fila
CREATE OR REPLACE FUNCTION cron.schedule_jobs()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_schedule RECORD;
BEGIN
  -- Para cada schedule ativo que precisa rodar
  FOR v_schedule IN
    SELECT cs.id, cs.tenant_id, cs.workflow, cs.params, cs.next_run_at
    FROM cron_schedules cs
    WHERE cs.enabled = TRUE
      AND (cs.next_run_at IS NULL OR cs.next_run_at <= NOW())
  LOOP
    -- Inserir na fila se ainda não existe pendente
    INSERT INTO cron_jobs_queue (tenant_id, workflow, params)
    VALUES (v_schedule.tenant_id, v_schedule.workflow, v_schedule.params)
    ON CONFLICT DO NOTHING;

    -- Atualizar próximo agendamento
    UPDATE cron_schedules
    SET next_run_at = calculate_next_run(
        cron_schedules.frequency, 
        cron_schedules.hour, 
        cron_schedules.minute, 
        cron_schedules.days_of_week
      ),
      last_run_at = NOW(),
      run_count = run_count + 1,
      updated_at = NOW()
    WHERE id = v_schedule.id;
  END LOOP;
END;
$$;

-- 3. Função para calcular próximo horário
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_frequency TEXT,
  p_hour INT,
  p_minute INT,
  p_days_of_week INT[]
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
  v_daysAhead INT;
  v_candidate TIMESTAMPTZ;
  v_dayOfWeek INT;
BEGIN
  v_now := NOW() AT TIME ZONE 'America/Sao_Paulo';

  IF p_frequency = 'HOURLY' THEN
    v_next := v_now + INTERVAL '1 hour';
    v_next := DATE_TRUNC('hour', v_next) + (p_minute || ' minutes')::interval;
    RETURN v_next;
  END IF;

  FOR v_daysAhead IN 0..7 LOOP
    v_candidate := v_now + (v_daysAhead || ' days')::interval;
    v_candidate := DATE_TRUNC('day', v_candidate) + (p_hour || ' hours')::interval + (p_minute || ' minutes')::interval;
    
    v_dayOfWeek := EXTRACT(DOW FROM v_candidate)::int;
    
    IF v_daysAhead > 0 OR v_dayOfWeek = p_days_of_week[1] THEN
      IF p_days_of_week @> ARRAY[v_dayOfWeek] THEN
        RETURN v_candidate;
      END IF;
    END IF;
  END LOOP;

  v_next := v_now + INTERVAL '1 day';
  v_next := DATE_TRUNC('day', v_next) + (p_hour || ' hours')::interval + (p_minute || ' minutes')::interval;
  RETURN v_next;
END;
$$;

-- 4. API route modificada para processar a fila
-- A API /api/cron/execute agora deve:
-- 1. Chamar cron.schedule_jobs() para agregar jobs
-- 2. Processar jobs da tabela cron_jobs_queue

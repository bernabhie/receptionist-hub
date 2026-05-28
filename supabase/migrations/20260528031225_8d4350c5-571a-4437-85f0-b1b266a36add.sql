
-- Extend patients with dentalcaps fields
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS medical_history text,
  ADD COLUMN IF NOT EXISTS lifestyle_notes text;

-- Extend appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS dentist_id uuid,
  ADD COLUMN IF NOT EXISTS appointment_type text;

DO $$ BEGIN
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'confirmed';
EXCEPTION WHEN others THEN NULL; END $$;

-- Extend invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS invoice_date date DEFAULT CURRENT_DATE;

-- Dentists
CREATE TABLE IF NOT EXISTS public.dentists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  specialization text,
  license_number text UNIQUE,
  years_experience integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dentists TO authenticated;
GRANT ALL ON public.dentists TO service_role;
ALTER TABLE public.dentists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage dentists" ON public.dentists FOR ALL TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER trg_dentists_touch BEFORE UPDATE ON public.dentists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Services
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  description text,
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage services" ON public.services FOR ALL TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER trg_services_touch BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Dental records
CREATE TABLE IF NOT EXISTS public.dental_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  dentist_id uuid REFERENCES public.dentists(id) ON DELETE SET NULL,
  diagnosis text,
  treatment_plan text,
  prescription text,
  notes text,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dental_records TO authenticated;
GRANT ALL ON public.dental_records TO service_role;
ALTER TABLE public.dental_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage dental records" ON public.dental_records FOR ALL TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER trg_dental_records_touch BEFORE UPDATE ON public.dental_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Treatments
CREATE TABLE IF NOT EXISTS public.treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.dental_records(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  treatment_date date NOT NULL DEFAULT CURRENT_DATE,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatments TO authenticated;
GRANT ALL ON public.treatments TO service_role;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage treatments" ON public.treatments FOR ALL TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER trg_treatments_touch BEFORE UPDATE ON public.treatments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Predictive appointment schedules (Decision Tree output log)
CREATE TABLE IF NOT EXISTS public.predictive_appointment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  predicted_day text NOT NULL,
  predicted_time time NOT NULL,
  predicted_duration smallint NOT NULL DEFAULT 30,
  confidence_score numeric(5,4) NOT NULL DEFAULT 0,
  model_version text NOT NULL DEFAULT '1.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictive_appointment_schedules TO authenticated;
GRANT ALL ON public.predictive_appointment_schedules TO service_role;
ALTER TABLE public.predictive_appointment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage predictive schedules" ON public.predictive_appointment_schedules
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER trg_pred_sched_touch BEFORE UPDATE ON public.predictive_appointment_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default services so the receptionist UI has options
INSERT INTO public.services (service_name, base_price, description) VALUES
  ('Checkup', 500, 'Routine dental checkup'),
  ('Cleaning', 800, 'Oral prophylaxis'),
  ('Filling', 1500, 'Composite filling'),
  ('Extraction', 1200, 'Tooth extraction'),
  ('Root Canal', 6500, 'Root canal treatment'),
  ('Consultation', 300, 'Dentist consultation')
ON CONFLICT DO NOTHING;

#!/usr/bin/env bash
# ============================================================================
# REWRITE_HISTORY.sh
# ----------------------------------------------------------------------------
# Remove arquivos com PII (cookies, dumps de pacientes, HTMLs de scraping,
# headers etc.) do histórico GIT inteiro do repositório.
#
# AÇÃO DESTRUTIVA — exige FORCE PUSH e invalida todos os clones existentes.
# Coordene com TODA a equipe antes de rodar (parar PRs em andamento,
# re-clonar depois).
#
# Pré-requisitos:
#   pip install git-filter-repo   # ou apt install git-filter-repo
#
# Como rodar (em uma máquina recém-clonada):
#   git clone https://github.com/daawgarcia/Ortholab.git
#   cd Ortholab
#   bash REWRITE_HISTORY.sh
#   git push --force-with-lease origin main
#
# Depois disso, ROTACIONE TODOS OS SEGREDOS que possam ter passado pelo repo:
#   - JWT_SECRET / JWT_REFRESH_SECRET
#   - REDE_PV / REDE_TOKEN / PAYMENT_WEBHOOK_SECRET / REDE_WEBHOOK_AUTH
#   - SMTP_USER / SMTP_PASS
#   - S3_ACCESS_KEY / S3_SECRET_KEY
#   - DATABASE_URL (rotacione a senha do Postgres)
#   - Qualquer cookie de sessão capturado em cookies*.txt
# ============================================================================

set -euo pipefail

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "git-filter-repo não encontrado. Instale com 'pip install git-filter-repo'." >&2
  exit 1
fi

cat > .git-history-paths.txt <<'EOF'
cookies.txt
cookies2.txt
dashboard.html
dashboard_headers.txt
dentist_edit.html
dentists_list_js.js
list_headers.txt
list_patients.json
login2.html
login_page.html
page_clinical_records.html
page_clinical_record_new.html
page_completion_forms.html
page_completion_new.html
page_dentists.html
page_dentist_new.html
page_otherservices_new.html
page_other_services.html
page_patients.html
page_patient_new.html
page_permissions.html
page_planning_forms.html
page_plan_form_new.html
page_plan_form_new_headers.txt
page_plan_new_patient.html
page_profiles.html
page_profile_dentist.html
page_pt_clinical_records.html
page_pt_completion_forms.html
page_pt_other_services.html
page_pt_photos.html
page_pt_planning_forms.html
page_pt_report.html
page_pt_workflows.html
page_pt_workflows_progress.html
page_user_edit.html
page_wf_expedition.html
page_wf_financial.html
page_wf_laboratory.html
page_wf_planning_center.html
page_wf_print.html
patients_ajax.json
patients_api.json
patients_api_headers.txt
patients_json.txt
patients_json_headers.txt
patients_list_js.js
patients_s2_headers.txt
patients_search.txt
patients_search2.txt
patients_search_a.json
patients_s_a_headers.txt
patient_1.html
patient_1_headers.txt
patient_edit.html
patient_edit_headers.txt
post_headers2.txt
post_response.html
post_response2.html
response_headers.txt
stl_upper.html
workflow_detail.html
EOF

echo "==> Rodando git-filter-repo para remover arquivos do histórico..."
git filter-repo --invert-paths --paths-from-file .git-history-paths.txt --force

rm -f .git-history-paths.txt

echo ""
echo "✅ Histórico reescrito. Próximos passos:"
echo "   1) Reaponte o remote:  git remote add origin https://github.com/daawgarcia/Ortholab.git"
echo "   2) Force push:         git push --force-with-lease origin main"
echo "   3) ROTACIONE todos os segredos que possam ter sido expostos."
echo "   4) Avise a equipe para reclonar o repositório."

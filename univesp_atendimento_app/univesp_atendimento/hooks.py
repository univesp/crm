app_name = "univesp_atendimento"
app_title = "UNIVESP Atendimento"
app_publisher = "UNIVESP"
app_description = "Backend institucional do Atendimento UNIVESP"
app_email = ""
app_license = "GPL-3.0"

required_apps = ["helpdesk"]

after_install = "univesp_atendimento.install.after_install"
after_migrate = "univesp_atendimento.install.after_migrate"

doc_events = {
	"HD Ticket": {
		"after_insert": "univesp_atendimento.ticket_hooks.on_ticket_created",
	}
}

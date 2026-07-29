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

scheduler_events = {
	"cron": {
		"* * * * *": [
			"univesp_atendimento.api.v1.knowledge_v3.activate_scheduled_versions",
			"univesp_atendimento.api.v1.knowledge_v3.expire_published_versions",
		],
	},
	"hourly": [
		"univesp_atendimento.api.v1.knowledge_collaboration.alert_overdue_suggestions",
	],
}

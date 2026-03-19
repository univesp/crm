<script setup>
import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StageCard from '@/components/StageCard.vue'
import { integrationBlueprint, journeyStages } from '@/data/flowBlueprint'
import { useJourneyStore } from '@/stores/journey'

const journey = useJourneyStore()
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="Blueprint"
      title="Sequencia sugerida para o primeiro MVP"
      description="Este prototipo organiza a experiencia de atendimento em blocos claros para voce esbocar telas, contratos e responsabilidades antes de integrar tudo no CRM."
    >
      <div class="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div class="rounded-[28px] bg-slate-950 p-7 text-white">
          <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
            Jornada principal
          </p>
          <h3 class="mt-4 text-4xl font-semibold">
            Primeiro contato, triagem, ticket, IA, handoff humano.
          </h3>
          <p class="mt-4 max-w-2xl text-sm leading-7 text-white/75">
            O recorte aqui e proposital: receber o aluno ja autenticado, coletar contexto minimo,
            abrir um protocolo no Frappe, tentar resolver com IA e so depois escalar com briefing.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <RouterLink
              to="/triagem"
              class="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Ir para triagem
            </RouterLink>
            <RouterLink
              to="/integracoes"
              class="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white"
            >
              Ver integracoes
            </RouterLink>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <MetricCard
            label="Fluxos base"
            :value="4"
            hint="Matricula, financeiro, documentos e suporte ao AVA."
          />
          <MetricCard
            label="Cobertura do prototipo"
            :value="`${journey.completion}%`"
            hint="As respostas da triagem alimentam as demais etapas."
          />
          <MetricCard
            label="Canal inicial"
            :value="journey.customer.channel"
            hint="Preparado para receber usuario autenticado via SAML."
          />
        </div>
      </div>
    </SectionPanel>

    <section class="grid gap-4 xl:grid-cols-3">
      <StageCard
        v-for="stage in journeyStages"
        :key="stage.id"
        :stage="stage"
        :active="journey.session.stage === stage.id"
      />
    </section>

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionPanel
        eyebrow="Recorte"
        title="O que precisa nascer junto"
        description="Para o atendimento funcionar bem, nao basta uma tela bonita. E preciso desenhar os contratos entre frontend, Frappe, IA e fila humana."
      >
        <div class="grid gap-4 md:grid-cols-2">
          <div class="inner-panel p-5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Entrada
            </p>
            <h3 class="mt-3 text-xl font-semibold text-slate-950">SSO e triagem sem friccao</h3>
            <p class="mt-3 text-sm leading-6 text-slate-600">
              O aluno nao deve preencher dados que ja vieram do IdP. O formulario inicial deve
              focar em intencao, urgencia e evidencias.
            </p>
          </div>
          <div class="inner-panel p-5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Persistencia
            </p>
            <h3 class="mt-3 text-xl font-semibold text-slate-950">Ticket como fonte de contexto</h3>
            <p class="mt-3 text-sm leading-6 text-slate-600">
              Tudo o que a IA usar ou resumir deve voltar para o ticket. Isso evita handoff cego e
              recontato desnecessario.
            </p>
          </div>
          <div class="inner-panel p-5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">IA</p>
            <h3 class="mt-3 text-xl font-semibold text-slate-950">Resposta com limites claros</h3>
            <p class="mt-3 text-sm leading-6 text-slate-600">
              O bot precisa de playbooks e criterio explicito de escalacao. Nao deve improvisar
              politica academica ou financeira.
            </p>
          </div>
          <div class="inner-panel p-5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Operacao
            </p>
            <h3 class="mt-3 text-xl font-semibold text-slate-950">Fila humana com briefing pronto</h3>
            <p class="mt-3 text-sm leading-6 text-slate-600">
              O atendente final precisa receber protocolo, transcript resumido, anexos e decisao da
              triagem em uma unica visao.
            </p>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Esteiras"
        title="Pontos criticos de integracao"
        description="Esses eixos devem ser tratados cedo para o prototipo virar produto sem retrabalho."
      >
        <div class="grid gap-3">
          <div
            v-for="item in integrationBlueprint"
            :key="item.id"
            class="inner-panel p-4"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 class="text-lg font-semibold text-slate-950">{{ item.name }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.description }}</p>
              </div>
              <span class="soft-chip">{{ item.status }}</span>
            </div>
            <div class="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
              <span class="rounded-full bg-slate-100 px-3 py-1">Owner: {{ item.owner }}</span>
              <span class="rounded-full bg-slate-100 px-3 py-1">
                Entrega: {{ item.deliverable }}
              </span>
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>

<script setup>
import MetricCard from '@/components/MetricCard.vue'
import SectionPanel from '@/components/SectionPanel.vue'
import StageCard from '@/components/StageCard.vue'
import { integrationBlueprint, journeyStages } from '@/data/flowBlueprint'
import { experiencePillars } from '@/data/frontendBlueprint'
import { servicePersonas } from '../../mocks/personas'
import { useJourneyStore } from '@/stores/journey'

const journey = useJourneyStore()
</script>

<template>
  <div class="grid gap-6">
    <SectionPanel
      eyebrow="Posicionamento"
      title="Uma central de atendimento pensada para a operacao real da UNIVESP"
      description="Esta primeira camada do frontend organiza a experiencia institucional antes da integracao definitiva com Frappe. O foco e reduzir atrito para o aluno, dar contexto para o OP e criar visibilidade para a gestao."
    >
      <div class="crm-split-grid gap-5">
        <div class="rounded-[32px] bg-slate-950 p-7 text-white">
          <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
            Direcao desta fase
          </p>
          <h3 class="mt-4 max-w-3xl text-4xl font-semibold">
            Receber o aluno com menos friccao, organizar a operacao e preparar a integracao futura.
          </h3>
          <p class="mt-4 max-w-2xl text-sm leading-7 text-white/75">
            O recorte atual comeca no frontend institucional: entrada autenticada, triagem guiada,
            protocolo rastreavel, fila operacional do polo e escalacao humana com briefing pronto.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <RouterLink
              to="/triagem"
              class="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Ver a entrada do atendimento
            </RouterLink>
            <RouterLink
              to="/integracoes"
              class="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white"
            >
              Revisar dependencias
            </RouterLink>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <MetricCard
            label="Perfis atendidos"
            :value="3"
            hint="Aluno, operacao OP e gestao administrativa."
          />
          <MetricCard
            label="Fluxos priorizados"
            :value="4"
            hint="Matricula, financeiro, documentos e suporte ao AVA."
          />
          <MetricCard
            label="Canal inicial"
            :value="journey.customer.channel"
            hint="Base preparada para autenticacao institucional via SAML."
          />
        </div>
      </div>
    </SectionPanel>

    <SectionPanel
      eyebrow="Personas"
      title="A jornada precisa funcionar para tres frentes ao mesmo tempo"
      description="O frontend institucional nao e apenas uma tela de abertura. Ele precisa equilibrar autonomia do aluno, produtividade operacional e leitura de gestao."
    >
      <div class="grid gap-4 xl:grid-cols-3">
        <RouterLink
          v-for="persona in servicePersonas"
          :key="persona.id"
          :to="persona.route"
          :class="[
            'group flex h-full flex-col rounded-[28px] border border-slate-900/10 p-6 transition-all duration-200 hover:-translate-y-1',
            persona.accentClass,
          ]"
        >
          <div class="flex items-center justify-between gap-4">
            <span :class="['soft-chip', persona.chipClass]">{{ persona.id }}</span>
            <span class="text-sm font-semibold opacity-70">Visao prioritaria</span>
          </div>
          <h3 class="mt-8 text-3xl font-semibold">{{ persona.name }}</h3>
          <p class="mt-3 text-sm leading-7 opacity-80">{{ persona.summary }}</p>
          <div class="mt-6 grid gap-2">
            <div
              v-for="highlight in persona.highlights"
              :key="highlight"
              class="rounded-[20px] border border-current/10 px-4 py-3 text-sm"
            >
              {{ highlight }}
            </div>
          </div>
          <span class="mt-6 text-sm font-semibold">
            {{ persona.cta }}
          </span>
        </RouterLink>
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

    <div class="crm-split-grid gap-6">
      <SectionPanel
        eyebrow="Experiencia"
        title="Principios que sustentam a central"
        description="Esses pilares orientam o frontend institucional e evitam que a experiencia vire apenas um mock visual desconectado da operacao."
      >
        <div class="grid gap-4 md:grid-cols-2">
          <div
            v-for="pillar in experiencePillars"
            :key="pillar.id"
            class="inner-panel p-5"
          >
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {{ pillar.id }}
            </p>
            <h3 class="mt-3 text-xl font-semibold text-slate-950">{{ pillar.name }}</h3>
            <p class="mt-3 text-sm leading-6 text-slate-600">{{ pillar.description }}</p>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Entrega"
        title="Pontos criticos para a proxima etapa"
        description="A camada visual ja antecipa dependencias que vao determinar a viabilidade do produto em operacao."
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

        <div class="mt-5 rounded-[28px] bg-amber-50 p-5 text-amber-950">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
            Leitura de gestao
          </p>
          <p class="mt-3 text-sm leading-6">
            O frontend institucional ja deixa explicito onde dependemos de backend, autenticacao e
            fila humana. Isso reduz retrabalho quando a integracao com Frappe sair do mock.
          </p>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>

import ConsultForm from '../model/ConsultForm'
import styled from 'styled-components'

export default function Casual() {
  return (
    <Style>
      <ConsultForm />
    </Style>
  )
}

const Style = styled.div`
  && .consult {
    border-top: 0;
    min-height: calc(100svh - var(--fortune-nav-height, 64px));
  }
`

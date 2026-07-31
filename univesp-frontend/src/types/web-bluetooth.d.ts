type BluetoothLEScanFilter = unknown
type BluetoothServiceUUID = string | number

interface BluetoothDevice {
  readonly id?: string
  readonly name?: string
}

interface BluetoothRemoteGATTServer {
  readonly connected?: boolean
}
